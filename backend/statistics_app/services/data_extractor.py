import os
import re
import pandas as pd
import pdfplumber


def _clean_number(val):
    """Safely converts string currency or formatted numbers to float."""
    if pd.isna(val) or val is None:
        return 0.0
    if isinstance(val, (int, float)):
        return float(val)
    val_str = str(val).strip().replace('$', '').replace('€', '').replace('£', '').replace(',', '')
    try:
        return float(val_str)
    except ValueError:
        return 0.0


def _find_column(df_cols, possible_names):
    """Finds a column in dataframe matching any of the possible names (case-insensitive)."""
    for col in df_cols:
        col_clean = str(col).strip().lower().replace('_', ' ').replace('-', ' ')
        for name in possible_names:
            if name.lower() in col_clean:
                return col
    return None


def extract_csv_metrics(file_path):
    """Parses business CSV and calculates financial & customer metrics."""
    df = pd.read_csv(file_path)
    cols = list(df.columns)

    # Detect key columns
    sales_col = _find_column(cols, ['sales', 'revenue', 'amount', 'price', 'total', 'income'])
    cost_col = _find_column(cols, ['cost', 'costing', 'expense', 'expenses', 'cogs', 'spend'])
    customer_col = _find_column(cols, ['customer name', 'customer', 'client', 'buyer', 'name', 'account', 'user'])
    email_col = _find_column(cols, ['email', 'contact', 'customer email'])
    segment_col = _find_column(cols, ['segment', 'tier', 'type', 'industry', 'category'])
    date_col = _find_column(cols, ['date', 'order date', 'month', 'period', 'timestamp', 'time'])
    category_col = _find_column(cols, ['category', 'product', 'item', 'department', 'service'])

    # Clean numeric columns
    if sales_col:
        df['_sales'] = df[sales_col].apply(_clean_number)
    else:
        df['_sales'] = 0.0

    if cost_col:
        df['_cost'] = df[cost_col].apply(_clean_number)
    else:
        df['_cost'] = 0.0

    total_sales = round(float(df['_sales'].sum()), 2)
    total_costs = round(float(df['_cost'].sum()), 2)
    net_profit = round(total_sales - total_costs, 2)
    profit_margin = round((net_profit / total_sales * 100), 2) if total_sales > 0 else 0.0

    # Customer analysis
    if customer_col:
        unique_customers = df[customer_col].dropna().nunique()
        cust_grouped = df.groupby(customer_col).agg(
            total_spend=('_sales', 'sum'),
            orders_count=('_sales', 'count')
        ).reset_index().sort_values(by='total_spend', ascending=False)

        top_customers = []
        for _, row in cust_grouped.head(8).iterrows():
            cust_name = str(row[customer_col])
            spend = round(float(row['total_spend']), 2)
            pct = round((spend / total_sales * 100), 1) if total_sales > 0 else 0.0
            top_customers.append({
                'name': cust_name,
                'spend': spend,
                'orders': int(row['orders_count']),
                'share_pct': pct
            })
    else:
        unique_customers = len(df)
        top_customers = []

    arpu = round(total_sales / unique_customers, 2) if unique_customers > 0 else 0.0

    # Monthly / Period timeline
    monthly_data = []
    if date_col:
        try:
            df['_date'] = pd.to_datetime(df[date_col], errors='coerce')
            df['_month'] = df['_date'].dt.strftime('%b %Y')
            month_grouped = df.groupby('_month', sort=False).agg(
                sales=('_sales', 'sum'),
                costs=('_cost', 'sum')
            ).reset_index()
            for _, r in month_grouped.iterrows():
                s = round(float(r['sales']), 2)
                c = round(float(r['costs']), 2)
                monthly_data.append({
                    'period': str(r['_month']) if pd.notna(r['_month']) else 'Period',
                    'sales': s,
                    'costs': c,
                    'profit': round(s - c, 2)
                })
        except Exception:
            pass

    # If no valid monthly data found, generate period buckets
    if not monthly_data:
        chunk_size = max(1, len(df) // 4)
        for i in range(0, len(df), chunk_size):
            chunk = df.iloc[i:i + chunk_size]
            s = round(float(chunk['_sales'].sum()), 2)
            c = round(float(chunk['_cost'].sum()), 2)
            monthly_data.append({
                'period': f"Batch {len(monthly_data) + 1}",
                'sales': s,
                'costs': c,
                'profit': round(s - c, 2)
            })

    # Category breakdown
    cat_breakdown = []
    if category_col:
        cat_grouped = df.groupby(category_col)['_cost'].sum().reset_index().sort_values(by='_cost', ascending=False)
        for _, r in cat_grouped.head(6).iterrows():
            cat_breakdown.append({
                'name': str(r[category_col]),
                'amount': round(float(r['_cost']), 2)
            })

    # Preview rows (first 6 rows without internal helper columns)
    preview_df = df.drop(columns=[c for c in df.columns if c.startswith('_')], errors='ignore').head(6)
    preview_rows = preview_df.fillna('').to_dict(orient='records')

    return {
        'file_type': 'csv',
        'rows_count': len(df),
        'total_sales': total_sales,
        'total_costs': total_costs,
        'net_profit': net_profit,
        'profit_margin': profit_margin,
        'total_customers': unique_customers,
        'arpu': arpu,
        'top_customers': top_customers,
        'monthly_timeline': monthly_data,
        'category_breakdown': cat_breakdown,
        'columns': [c for c in cols if not c.startswith('_')],
        'preview_rows': preview_rows,
    }


def extract_pdf_metrics(file_path):
    """Extracts text and table summaries from PDF files."""
    extracted_text = ""
    tables = []

    with pdfplumber.open(file_path) as pdf:
        for idx, page in enumerate(pdf.pages[:5]):
            page_text = page.extract_text() or ""
            extracted_text += f"\n--- Page {idx+1} ---\n" + page_text
            page_tables = page.extract_tables()
            if page_tables:
                tables.extend(page_tables[:2])

    # Simple regex extraction for financial numbers
    revenue_match = re.search(r'(?:total\s+revenue|total\s+sales|sales|revenue)[\s:]*[\$]?([\d,]+(?:\.\d{2})?)', extracted_text, re.IGNORECASE)
    cost_match = re.search(r'(?:total\s+expenses|total\s+cost|costs|expenses|cogs)[\s:]*[\$]?([\d,]+(?:\.\d{2})?)', extracted_text, re.IGNORECASE)

    total_sales = _clean_number(revenue_match.group(1)) if revenue_match else 0.0
    total_costs = _clean_number(cost_match.group(1)) if cost_match else 0.0
    net_profit = round(total_sales - total_costs, 2)
    profit_margin = round((net_profit / total_sales * 100), 2) if total_sales > 0 else 0.0

    return {
        'file_type': 'pdf',
        'rows_count': len(extracted_text.splitlines()),
        'total_sales': total_sales,
        'total_costs': total_costs,
        'net_profit': net_profit,
        'profit_margin': profit_margin,
        'total_customers': 0,
        'arpu': 0.0,
        'top_customers': [],
        'monthly_timeline': [],
        'category_breakdown': [],
        'columns': [],
        'preview_rows': [],
        'extracted_text_sample': extracted_text[:4000],
    }


def process_uploaded_file(file_path):
    """Main entrypoint: parses file by extension."""
    ext = os.path.splitext(file_path)[1].lower()
    if ext == '.csv':
        return extract_csv_metrics(file_path)
    elif ext == '.pdf':
        return extract_pdf_metrics(file_path)
    else:
        raise ValueError(f"Unsupported file format: {ext}. Only .csv and .pdf are supported.")
