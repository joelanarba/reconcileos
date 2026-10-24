import re
from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.core.errors import AppError
from app.core.money import PRECISION
from app.schemas.imports import ImportOptions
from app.services.imports.csv_parser import TEMPLATES, content_hash, parse_row


LABELS = {"order_ref": "Order reference", "transaction_ref": "Transaction reference", "amount": "Amount", "currency": "Currency", "ordered_at": "Order date", "paid_at": "Payment date", "status": "Status", "provider": "Payment provider", "description": "Description"}
LABELS.update({"settlement_ref": "Settlement reference", "payment_ref": "Related transaction reference", "gross_amount": "Gross amount", "fee_amount": "Fee amount", "net_amount": "Net amount", "settled_at": "Settlement date"})
ALIASES = {
    "order_ref": {"orderref", "orderreference", "orderid", "ordernumber", "orderno", "invoiceref", "invoicenumber", "invoiceid", "invoiceno", "merchantreference", "merchantref"},
    "transaction_ref": {"transactionref", "transactionreference", "transactionid", "transactionnumber", "paymentref", "paymentreference", "paymentid", "receiptid", "receiptnumber", "reference", "referenceid", "transactionno"},
    "amount": {"amount", "total", "totalamount", "ordertotal", "orderamount", "expectedamount", "paymentamount", "paidamount", "amountpaid", "transactionamount", "grossamount", "value", "totalpaid", "amountminor", "amountinminorunits", "amountpesewas", "amountcents"},
    "currency": {"currency", "currencycode", "ccy"},
    "ordered_at": {"orderedat", "orderdate", "orderdatetime", "date", "datetime", "createdat", "createddate", "timestamp", "invoicedate"},
    "paid_at": {"paidat", "paymentdate", "transactiondate", "datepaid", "date", "datetime", "createdat", "timestamp", "transactiontime", "paymenttime", "transactiondatetime"},
    "status": {"status", "paymentstatus", "transactionstatus", "orderstatus", "state", "paymentstate"},
    "provider": {"provider", "paymentprovider", "paymentmethod", "paymentchannel", "channel", "network", "gateway", "processor"},
    "description": {"description", "details", "narration", "notes", "note", "memo", "item", "product", "remarks"},
}
STATUS_ALIASES = {
    "settlements": {},
    "orders": {"open": "open", "new": "open", "pending": "open", "unpaid": "open", "processing": "open", "completed": "completed", "complete": "completed", "paid": "completed", "fulfilled": "completed", "delivered": "completed", "shipped": "completed", "cancelled": "cancelled", "canceled": "cancelled", "void": "cancelled", "refunded": "cancelled"},
    "payments": {"successful": "successful", "success": "successful", "succeeded": "successful", "paid": "successful", "completed": "successful", "complete": "successful", "approved": "successful", "settled": "successful", "pending": "pending", "processing": "pending", "initiated": "pending", "queued": "pending", "failed": "failed", "failure": "failed", "declined": "failed", "unsuccessful": "failed", "cancelled": "failed", "canceled": "failed", "reversed": "reversed", "refunded": "reversed"},
}

ALIASES.update({
    "settlement_ref": {"settlementref", "settlementreference", "settlementid", "payoutref", "payoutreference", "payoutid", "reference", "id"},
    "payment_ref": ALIASES["transaction_ref"] - {"reference", "referenceid"},
    "gross_amount": {"grossamount", "gross", "transactionamount", "paymentamount", "amount", "grossminor", "grossamountminor"},
    "fee_amount": {"feeamount", "fee", "fees", "processingfee", "transactionfee", "charges", "feeminor", "feeamountminor"},
    "net_amount": {"netamount", "net", "settledamount", "settlementamount", "payoutamount", "netminor", "netamountminor"},
    "settled_at": {"settledat", "settlementdate", "settleddate", "payoutdate", "date", "datetime", "timestamp"},
})


def header_key(value):
    return re.sub(r"[^a-z0-9]", "", value.casefold())


def suggest_mapping(headers, source_type):
    mapping = {}
    for field in TEMPLATES[source_type]:
        aliases = ALIASES[field] | ({"reference", "id"} if field == "order_ref" and source_type == "orders" else set())
        candidates = []
        for header in headers:
            normalized = header_key(re.sub(r" \[[0-9]+\]$", "", header).replace("GH\u20b5", "GHS").replace("GH\u00a2", "GHS"))
            if field in ("amount", "gross_amount", "fee_amount", "net_amount"):
                normalized = re.sub(r"(ghs|usd|eur|gbp|jpy|kwd)$", "", normalized)
            if normalized in aliases:
                candidates.append(header)
        mapping[field] = candidates[0] if len(candidates) == 1 else None
    return mapping


def choose_header(table, source_type):
    scored = []
    for row in table["rows"][:25]:
        if any(value.strip() for value in row["cells"]):
            score = sum(value is not None for value in suggest_mapping(row["cells"], source_type).values())
            scored.append((score, -row["source_row"], row["source_row"]))
    return max(scored)[2] if scored else 1


def normalize_provider(value):
    normalized = header_key(value)
    aliases = {"mtn": "MTN_MOMO", "mtnmomo": "MTN_MOMO", "mtnmobilemoney": "MTN_MOMO", "telecel": "TELECEL_CASH", "telecelcash": "TELECEL_CASH", "bank": "BANK_TRANSFER", "banktransfer": "BANK_TRANSFER", "paymentgateway": "PAYMENT_GATEWAY"}
    return aliases.get(normalized, re.sub(r"[^A-Z0-9]+", "_", value.strip().upper()).strip("_"))


def normalize_amount(value, currency, style, numeric=False):
    text = value.strip()
    symbols = {"GHS": ["GH\u20b5", "GH\u00a2", "GHS"], "USD": ["USD", "$"], "EUR": ["EUR", "\u20ac"], "GBP": ["GBP", "\u00a3"], "JPY": ["JPY", "\u00a5"], "KWD": ["KWD"]}
    for symbol in symbols.get(currency, [currency]):
        if text.upper().startswith(symbol.upper()):
            text = text[len(symbol):].strip()
        if text.upper().endswith(symbol.upper()):
            text = text[:-len(symbol)].strip()
    text = text.replace("\u00a0", " ").replace("\u202f", " ")
    if re.fullmatch(r"[0-9]{1,3}(?: [0-9]{3})+(?:[.,][0-9]+)?", text):
        text = text.replace(" ", "")
    if re.fullmatch(r"[0-9]+(?:\.[0-9]+)?[eE][+-]?[0-9]{1,2}", text):
        number = Decimal(text)
        if abs(number.as_tuple().exponent) > 18:
            raise ValueError("The amount is outside the supported precision range.")
        text = format(number, "f")
        numeric = True
    decimal = "." if numeric else ("." if style == "dot" else "," if style == "comma" else None)
    if decimal is None:
        if "." in text and "," in text:
            decimal = "." if text.rfind(".") > text.rfind(",") else ","
        elif "," in text or "." in text:
            separator = "," if "," in text else "."
            pieces = text.split(separator)
            if len(pieces) > 2 and all(len(piece) == 3 for piece in pieces[1:]):
                decimal = "." if separator == "," else ","
            elif len(pieces) == 2 and len(pieces[1]) == 3:
                raise ValueError("This amount could use a decimal or thousands separator. Choose its number format above.")
            else:
                decimal = separator
        else:
            decimal = "."
    grouping = "," if decimal == "." else "."
    if grouping in text:
        integer, _, fraction = text.partition(decimal)
        if not re.fullmatch(r"[0-9]{1,3}(?:" + re.escape(grouping) + r"[0-9]{3})+", integer) or grouping in fraction:
            raise ValueError("The grouping separators in this amount are inconsistent. Choose its number format or correct the value here.")
        text = integer.replace(grouping, "") + (decimal + fraction if decimal in text else "")
    text = text.replace(decimal, ".")
    if "." in text:
        text = text.rstrip("0").rstrip(".")
    return text


def normalize_date(value, options, timezone):
    text = value.strip()
    if not text:
        return ""
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        parsed = None
        date_formats = ["%d/%m/%Y", "%d-%m-%Y", "%d/%m/%y"] if options.date_order == "DMY" else ["%m/%d/%Y", "%m-%d-%Y", "%m/%d/%y"]
        date_formats += ["%Y/%m/%d", "%d %b %Y", "%d %B %Y", "%b %d, %Y", "%B %d, %Y"]
        for date_format in date_formats:
            for time_format in ("", " %H:%M:%S", " %H:%M", " %I:%M:%S %p", " %I:%M %p"):
                try:
                    parsed = datetime.strptime(text, date_format + time_format)
                    break
                except ValueError:
                    pass
            if parsed is not None:
                break
        if parsed is None:
            raise ValueError("This date was not recognized. Choose day/month or month/day above, or enter a corrected date here.")
    if parsed.tzinfo is None:
        first = parsed.replace(tzinfo=timezone, fold=0)
        second = parsed.replace(tzinfo=timezone, fold=1)
        if first.utcoffset() != second.utcoffset() or first.astimezone(UTC).astimezone(timezone).replace(tzinfo=None) != parsed:
            raise ValueError("This local time is ambiguous or does not exist. Enter the timestamp with an explicit UTC offset.")
        parsed = first
    return parsed.astimezone(UTC).isoformat()


def build_preview(document, source_type, options: ImportOptions, max_rows, *, infer_defaults=False):
    if source_type not in TEMPLATES:
        raise AppError("invalid_source", "Choose the type of records in this file.")
    try:
        timezone = ZoneInfo(options.timezone)
    except (ZoneInfoNotFoundError, ValueError) as error:
        raise AppError("invalid_timezone", "Select a recognized timezone for dates without an offset.") from error
    tables = [table for table in document["tables"] if any(any(value.strip() for value in row["cells"]) for row in table["rows"])]
    if not tables:
        raise AppError("empty_file", "This file does not contain any records.")
    if options.sheet:
        table = next((table for table in tables if table["name"] == options.sheet), None)
        if table is None:
            raise AppError("invalid_sheet", "Choose one of the worksheets in this file.")
    else:
        table = max(tables, key=lambda candidate: sum(value is not None for value in suggest_mapping(next((row["cells"] for row in candidate["rows"] if row["source_row"] == choose_header(candidate, source_type)), []), source_type).values()))
    header_row = options.header_row if options.header_row is not None else choose_header(table, source_type)
    source_header = next((row["cells"] for row in table["rows"] if row["source_row"] == header_row), []) if header_row else []
    width = max((len(row["cells"]) for row in table["rows"]), default=0)
    if width > 100:
        raise AppError("too_many_columns", "Choose a worksheet with at most 100 columns.", 413)
    headers, seen_headers = [], {}
    for position in range(width):
        label = source_header[position].strip() if position < len(source_header) else ""
        label = label or f"Column {position + 1}"
        if len(label) > 160:
            label = label[:157] + "..."
        seen_headers[label] = seen_headers.get(label, 0) + 1
        headers.append(label if seen_headers[label] == 1 else f"{label} [{seen_headers[label]}]")
    mapping = suggest_mapping(headers, source_type)
    for field, column in options.column_map.items():
        if field not in mapping or column is not None and column not in headers:
            raise AppError("invalid_mapping", "A selected column does not belong to this worksheet or record type.")
        mapping[field] = column
    primary_amount = "gross_amount" if source_type == "settlements" else "amount"
    amount_header = (mapping.get(primary_amount) or "").upper().replace("GH\u20b5", "GHS").replace("GH\u00a2", "GHS")
    amount_header = amount_header.replace("\u20ac", "EUR")
    currency_hints = re.findall(r"(?:^|[^A-Z])(GHS|USD|EUR|GBP|JPY|KWD)(?=$|[^A-Z])", amount_header)
    amount_heading_key = header_key(amount_header)
    if amount_heading_key[:-3] in ALIASES[primary_amount] and amount_heading_key[-3:].upper() in PRECISION:
        currency_hints.append(amount_heading_key[-3:].upper())
    currency_hint = currency_hints[0] if len(set(currency_hints)) == 1 else None
    annotated_codes = re.findall(r"[\[(]\s*([A-Z]{3})\s*[\])]", amount_header)
    unsupported_codes = [code for code in annotated_codes if code not in PRECISION and code not in ("NET", "TAX", "FEE", "VAT", "DUE", "SUM")]
    unit_heading_key = re.sub(r"(ghs|usd|eur|gbp|jpy|kwd)$", "", amount_heading_key)
    minor_hint = unit_heading_key.endswith(("minor", "minorunits", "pesewas", "pesewa", "cents"))
    if infer_defaults and currency_hint and not mapping.get("currency"):
        options = options.model_copy(update={"default_currency": currency_hint})
    if infer_defaults and minor_hint:
        options = options.model_copy(update={"amount_unit": "minor"})
    if (options.corrections or options.excluded_rows) and len(options.reason.strip()) < 3:
        raise AppError("reason_required", "Add a short reason for source corrections or excluded rows.")
    numeric_cells = set(table.get("numeric_cells", []))
    records, seen_rows, used_rows = [], {}, set()
    excluded = set(options.excluded_rows)
    transformations = 0
    defaults = {"currency": options.default_currency, "provider": options.default_provider, "status": options.default_status or ("open" if source_type == "orders" else ""),
                "ordered_at": options.default_date, "paid_at": options.default_date, "settled_at": options.default_date}
    unknown_statuses = set()
    for source in table["rows"]:
        if source["source_row"] <= header_row or not any(value.strip() for value in source["cells"]):
            continue
        if len(records) >= max_rows:
            raise AppError("too_many_rows", f"Import at most {max_rows:,} transaction rows at a time.", 413)
        row_number = source["source_row"]
        used_rows.add(row_number)
        raw = {header: source["cells"][position] if position < len(source["cells"]) else "" for position, header in enumerate(headers)}
        canonical, changes, normalization_errors = {}, [], []
        corrections = options.corrections.get(str(row_number), {})
        if any(field not in mapping for field in corrections):
            raise AppError("invalid_correction", "A correction refers to an unknown record field.")
        for field, column in mapping.items():
            value = raw.get(column, "") if column else ""
            coordinate = f"{row_number}:{headers.index(column) + 1}" if column else ""
            if field in corrections:
                value = corrections[field]
                changes.append(f"Operator corrected {LABELS[field]}: {options.reason.strip()}")
            elif coordinate in table.get("formulas", {}):
                formula = table["formulas"][coordinate]
                if options.allow_cached_formulas and formula["cached"]:
                    value = formula["cached"]
                    changes.append(f"Used the workbook's stored formula result for {LABELS[field]}; not recalculated.")
                else:
                    normalization_errors.append({"field": field, "message": "This cell is a formula. Enter a value here, or explicitly allow stored formula results if the workbook has them."})
            if not value.strip() and defaults.get(field):
                value = defaults[field]
                changes.append(f"Used the selected default for {LABELS[field]}.")
            original = value
            try:
                if field == "currency":
                    aliases = {"cedis": "GHS", "cedi": "GHS", "ghana cedi": "GHS", "gh\u20b5": "GHS", "gh\u00a2": "GHS"}
                    value = aliases.get(value.strip().casefold(), value.strip().upper())
                elif field == "provider":
                    value = normalize_provider(value)
                elif field == "status":
                    value = options.status_map.get(value, STATUS_ALIASES[source_type].get(header_key(value), value.strip().lower()))
                    if value not in set(STATUS_ALIASES[source_type].values()):
                        unknown_statuses.add(original)
                elif field in ("order_ref", "transaction_ref", "settlement_ref", "payment_ref") and coordinate in numeric_cells:
                    value = re.sub(r"\.0+$", "", value)
                elif field == "description" and len(value.strip()) > 500:
                    value = value.strip()[:500]
                    changes.append("Description shortened for the record display; the full original cell is retained.")
                canonical[field] = value
                if value != original:
                    changes.append(f"Recognized the source format for {LABELS[field]}.")
            except ValueError as error:
                normalization_errors.append({"field": field, "message": str(error)})
                canonical[field] = value
        edit_values = dict(canonical)
        for amount_field in (("gross_amount", "fee_amount", "net_amount") if source_type == "settlements" else ("amount",)):
            try:
                amount_column = mapping.get(amount_field)
                heading = (amount_column or "").upper().replace("GH\u20b5", "GHS").replace("GH\u00a2", "GHS").replace("\u20ac", "EUR")
                heading_key = header_key(heading)
                codes = re.findall(r"(?:^|[^A-Z])([A-Z]{3})(?=$|[^A-Z])", heading)
                codes = [code for code in codes if code in PRECISION or re.search(r"[\[(]\s*" + code + r"\s*[\])]", heading) and code not in ("NET", "TAX", "FEE", "VAT", "DUE", "SUM")]
                if heading_key[:-3] in ALIASES[amount_field] and heading_key[-3:].upper() in PRECISION:
                    codes.append(heading_key[-3:].upper())
                if any(code != canonical.get("currency") for code in codes):
                    raise ValueError("This amount heading identifies a different or unsupported currency. Review the mapping before import.")
                for symbol, code in (("$", "USD"), ("\u00a3", "GBP"), ("\u00a5", "JPY")):
                    if symbol in heading and code != canonical.get("currency"):
                        raise ValueError("This amount heading identifies a different currency. Review the mapping before import.")
                field_minor_hint = re.sub(r"(ghs|usd|eur|gbp|jpy|kwd)$", "", heading_key).endswith(("minor", "minorunits", "pesewas", "pesewa", "cents"))
                numeric_amount = bool(amount_column and f"{row_number}:{headers.index(amount_column) + 1}" in numeric_cells and amount_field not in corrections)
                amount = normalize_amount(canonical.get(amount_field, ""), canonical.get("currency", ""), options.decimal_style, numeric_amount)
                if options.amount_unit == "minor":
                    if not re.fullmatch(r"[0-9]+", amount) or canonical.get("currency") not in PRECISION:
                        raise ValueError("Minor-unit amounts must be whole non-negative integers in a supported currency.")
                    amount = format(Decimal(amount).scaleb(-PRECISION[canonical["currency"]]), "f")
                elif minor_hint or field_minor_hint:
                    raise ValueError("The amount column identifies minor units. Select minor units above before confirming.")
                if amount != canonical.get(amount_field, ""):
                    changes.append(f"Recognized {LABELS[amount_field]} formatting without changing its exact value.")
                canonical[amount_field] = amount
            except (ValueError, InvalidOperation) as error:
                normalization_errors.append({"field": amount_field, "message": str(error)})
        date_field = {"orders": "ordered_at", "payments": "paid_at", "settlements": "settled_at"}[source_type]
        try:
            date_value = normalize_date(canonical.get(date_field, ""), options, timezone)
            if date_value != canonical.get(date_field, ""):
                changes.append("Interpreted the source date using the selected date order and timezone.")
            canonical[date_field] = date_value
        except ValueError as error:
            normalization_errors.append({"field": date_field, "message": str(error)})
        parsed, errors = parse_row(canonical, source_type)
        if unsupported_codes:
            normalization_errors.append({"field": "currency", "message": f"The source amount column identifies unsupported currency {unsupported_codes[0]}. Its value cannot be assumed to be {canonical.get('currency')}."})
        if currency_hint and canonical.get("currency") != currency_hint:
            normalization_errors.append({"field": "currency", "message": f"The amount column identifies {currency_hint}, but this row is interpreted as {canonical.get('currency')}. Review the currency mapping or selected default."})
        for symbol, denomination in (("$", "USD"), ("\u00a3", "GBP"), ("\u00a5", "JPY")):
            if symbol in amount_header and canonical.get("currency") != denomination:
                normalization_errors.append({"field": "currency", "message": f"The amount heading uses {symbol}. Choose the supported source currency explicitly; it cannot be assumed to be {canonical.get('currency')}."})
        missing_messages = {"order_ref": "Choose the order reference column or enter the reference here.", "transaction_ref": "Choose the transaction reference column or enter the reference here.", "amount": "Choose the amount column or enter the amount here.", "ordered_at": "Choose the order date column or set a statement date above.", "paid_at": "Choose the payment date column or set a statement date above.", "provider": "Choose the provider column or set a provider above.", "status": "Choose a status column or explicitly set a status for this file above."}
        for error in errors:
            if not canonical.get(error["field"], "").strip() and error["field"] in missing_messages:
                error["message"] = missing_messages[error["field"]]
        if document["format"] == "CSV" and header_row and len(source["cells"]) > len(source_header):
            normalization_errors.append({"field": "row", "message": "This row has more cells than its header, often from an unquoted comma. Review the original row before importing it."})
        failed_fields = {error["field"] for error in normalization_errors}
        errors = normalization_errors + [error for error in errors if error["field"] not in failed_fields]
        row_hash = content_hash(raw)
        warnings = []
        if source_type == "settlements" and not errors and parsed["gross_minor"] - parsed["fee_minor"] != parsed["net_minor"]:
            warnings.append("Gross minus fee differs from recorded net. Values are retained for reconciliation review.")
        if row_hash in seen_rows:
            warnings.append(f"Identical source row also appears at row {seen_rows[row_hash]}. Evidence will be retained.")
        seen_rows.setdefault(row_hash, row_number)
        if row_number in excluded:
            warnings.append("Excluded by the operator: " + options.reason.strip())
        transformations += bool(changes)
        records.append({"source_row": row_number, "row_hash": row_hash, "raw": raw, "values": canonical, "edit_values": edit_values, "parsed": parsed, "errors": errors,
                        "warnings": warnings, "transformations": changes, "excluded": row_number in excluded})
    if not records:
        raise AppError("empty_file", "No transaction rows were found below the selected header. Choose a different header row or worksheet.")
    if excluded - used_rows or set(options.corrections) - {str(number) for number in used_rows}:
        raise AppError("invalid_correction", "A corrected or excluded row does not belong to the selected worksheet.")
    fields = [{"key": field, "label": LABELS[field], "required": field not in ("description", "currency", "status", "payment_ref") and not (field == "order_ref" and source_type == "payments")} for field in mapping]
    return {"columns": headers, "rows": records, "_source": document,
            "import_info": {"format": document["format"], "encoding": document.get("encoding"), "delimiter": document.get("delimiter"),
                            "sheets": [candidate["name"] for candidate in tables], "sheet": table["name"], "header_row": header_row, "mapping": mapping, "fields": fields,
                            "options": options.model_dump(exclude={"expected_revision"}), "transformed_rows": transformations, "excluded_rows": len(excluded),
                            "unknown_statuses": sorted(unknown_statuses)[:50], "allowed_statuses": sorted(set(STATUS_ALIASES[source_type].values()))}}
