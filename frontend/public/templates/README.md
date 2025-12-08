# CSV Export Templates

This directory should contain the official marketplace CSV templates.

## Required Files

- `depop_template.csv` - Official Depop CSV template with header row
- `shopify_template.csv` - Official Shopify CSV template with header row

## Template Format

The templates should be CSV files with:
1. First row: Header row with column names (exactly as expected by the marketplace)
2. Subsequent rows: Can be empty or contain example data

The export system will:
- Read the header row to determine column order and names
- Map product data to match these column names
- Generate CSV files with the exact same column order as the template

## Converting from XLSX

If you have an XLSX template file:
1. Open it in Excel or Google Sheets
2. Save as CSV (UTF-8 encoding)
3. Place the CSV file in this directory with the correct name

