"""
Seed Financial Statistics & CSV Files for All Startups and Demo Users
Location: backend/seed_all_startups_statistics.py

Creates 3 to 4 sequential monthly financial CSV statements for every demo startup in the database.
Computes real metrics using extract_csv_metrics, publishes the reports, aggregates multi-month financials,
and generates AI valuation verdicts, growth percentages, and 4-quarter forward forecasts.
"""

import os
import sys
import csv
import io
import random
from datetime import datetime

# Setup Django environment
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

import django
django.setup()

from django.core.files.base import ContentFile
from accounts.models import User
from startups.models import Startup
from statistics_app.models import StartupStatisticsReport, StartupAIVerdict
from statistics_app.services.data_extractor import extract_csv_metrics, aggregate_startup_reports
from statistics_app.services.ai_analyzer import generate_fallback_analysis


INDUSTRY_DATA_PRESETS = {
    'agritech': {
        'categories': ['Farm Inputs', 'Smart Sensor Hardware', 'Harvest Logistics', 'Cold Storage Subscription', 'Advisory Services'],
        'customers': [
            ('Bogura Agricoop Ltd', 'procurement@bogura-agri.bd', 'Enterprise'),
            ('Rajshahi Mango Farms', 'contact@rajshahimango.com', 'Mid-Market'),
            ('Kushtia Agro Traders', 'info@kushtia-agro.org', 'SMB'),
            ('Green Delta Farmers Group', 'accounts@greendeltafarms.bd', 'Enterprise'),
            ('Jessore Seed Corporation', 'orders@jessoreseeds.com', 'Mid-Market'),
            ('Northern Organic Harvest', 'contact@northernharvest.bd', 'SMB'),
            ('Sylhet Tea & Agro Alliance', 'mgmt@sylhettea.org', 'Enterprise'),
        ],
        'margin_range': (0.65, 0.78),
        'base_sales': 32000.0,
    },
    'fintech': {
        'categories': ['Merchant Gateway Fees', 'API Subscriptions', 'Remittance Commission', 'Cross-Border FX', 'Enterprise Security'],
        'customers': [
            ('Prime Commercial Bank', 'fintech-ops@primebank.bd', 'Enterprise'),
            ('ShurjoPay Merchants Group', 'billing@shurjopay.com', 'Mid-Market'),
            ('Apex Retail Chain', 'finance@apexretail.bd', 'Enterprise'),
            ('Dhanmondi Micro Traders', 'accounts@dhanmonditraders.com', 'SMB'),
            ('Chittagong Port Exporters', 'trade@ctg-exporters.org', 'Enterprise'),
            ('Bengal E-Commerce Network', 'payments@bengalecom.bd', 'Mid-Market'),
            ('Sylhet Overseas Remittance Club', 'info@sylhetremit.com', 'SMB'),
        ],
        'margin_range': (0.70, 0.85),
        'base_sales': 48000.0,
    },
    'healthtech': {
        'categories': ['Diagnostic Software', 'Telehealth Platform', 'Clinic Subscriptions', 'Hardware Kits', 'Genomics Analysis'],
        'customers': [
            ('Popular Diagnostic Centre', 'admin@populardiagnostic.bd', 'Enterprise'),
            ('Ibn Sina Hospital Trust', 'procurement@ibnsina.org', 'Enterprise'),
            ('Delta Rural Health Network', 'director@deltaruralhealth.bd', 'Mid-Market'),
            ('CarePoint Community Clinic', 'contact@carepointclinic.com', 'SMB'),
            ('Universal Medical College', 'clinical@universalmedical.bd', 'Enterprise'),
            ('Medinet Polyclinic Barishal', 'info@medinet-barishal.com', 'SMB'),
            ('Apollo Diagnostics Khulna', 'orders@apollokhulna.bd', 'Mid-Market'),
        ],
        'margin_range': (0.68, 0.82),
        'base_sales': 42000.0,
    },
    'cleantech': {
        'categories': ['Battery Swaps', 'Fleet Subscriptions', 'Solar Inverter Units', 'Carbon Credits', 'Maintenance Service'],
        'customers': [
            ('Dhaka Electric Transport', 'fleet@dhakaelectric.bd', 'Enterprise'),
            ('Green Energy Bangladesh', 'ops@greenenergy.bd', 'Enterprise'),
            ('Gulshan Delivery Courier Fleet', 'riders@gulshandelivery.com', 'Mid-Market'),
            ('Mirpur Solar Community', 'info@mirpursolar.org', 'SMB'),
            ('Padma Eco Logistics', 'dispatch@padmaeco.bd', 'Enterprise'),
            ('Chattogram Industrial Solar', 'admin@ctgsun.com', 'Mid-Market'),
            ('Barishal EV Rickshaw Union', 'contact@evrickshaw.org', 'SMB'),
        ],
        'margin_range': (0.55, 0.72),
        'base_sales': 38000.0,
    },
    'foodtech': {
        'categories': ['Online Grocery Orders', 'Cloud Kitchen Royalties', 'B2B Wholesale Supplies', 'Corporate Catering', 'Delivery Fees'],
        'customers': [
            ('Beximco Corporate Cafeteria', 'catering@beximco.bd', 'Enterprise'),
            ('North End Coffee Roasters', 'orders@northendbd.com', 'Mid-Market'),
            ('Chef Bazaar Dark Kitchens', 'supply@chefbazaar.com', 'Enterprise'),
            ('Banani Gourmet Express', 'orders@bananigourmet.bd', 'SMB'),
            ('Square Hospital Staff Meals', 'procurement@squarehospital.org', 'Enterprise'),
            ('Uttara Family Grocery Club', 'accounts@uttaragrocery.com', 'SMB'),
            ('Dhanmondi Club Dining', 'chef@dhanmondiclub.org', 'Mid-Market'),
        ],
        'margin_range': (0.35, 0.52),
        'base_sales': 55000.0,
    },
    'general': {
        'categories': ['Software License', 'Cloud Infrastructure', 'Consulting Services', 'Maintenance Retainer', 'Custom Integration'],
        'customers': [
            ('Acme Enterprise Corp', 'it-director@acme.com', 'Enterprise'),
            ('TechNova Solutions', 'billing@technova.io', 'Mid-Market'),
            ('Nexus Robotics Alliance', 'procurement@nexusrobotics.org', 'Enterprise'),
            ('Beacon Consulting Global', 'finance@beaconglobal.com', 'Mid-Market'),
            ('Summit Digital Labs', 'contact@summitdigital.bd', 'SMB'),
            ('Pioneer Systems Ltd', 'orders@pioneersys.com', 'SMB'),
            ('Metro Solutions Dhaka', 'admin@metrosolutions.bd', 'Mid-Market'),
        ],
        'margin_range': (0.60, 0.76),
        'base_sales': 35000.0,
    }
}


def pick_industry_preset(startup):
    tags_lower = [str(t).lower() for t in (startup.tags or [])]
    slug_lower = startup.slug.lower()
    name_lower = startup.name.lower()
    text = " ".join(tags_lower) + " " + slug_lower + " " + name_lower

    if any(k in text for k in ['agri', 'farm', 'khamar', 'crop', 'harvest']):
        return INDUSTRY_DATA_PRESETS['agritech']
    if any(k in text for k in ['fintech', 'pay', 'bank', 'remit', 'shonchoy', 'dokan', 'money']):
        return INDUSTRY_DATA_PRESETS['fintech']
    if any(k in text for k in ['health', 'med', 'clinic', 'diagnos', 'bio', 'genom', 'sheba']):
        return INDUSTRY_DATA_PRESETS['healthtech']
    if any(k in text for k in ['clean', 'solar', 'waste', 'electric', 'ev', 'energy', 'eco']):
        return INDUSTRY_DATA_PRESETS['cleantech']
    if any(k in text for k in ['food', 'kitchen', 'chaldal', 'grocery', 'qsr', 'dining', 'catering']):
        return INDUSTRY_DATA_PRESETS['foodtech']
    return INDUSTRY_DATA_PRESETS['general']


MONTHS_SEQUENCE = [
    {
        'period_name': 'November 2025',
        'file_suffix': 'nov_2025',
        'dates': ['2025-11-04', '2025-11-12', '2025-11-18', '2025-11-25', '2025-11-28'],
        'growth_factor': 0.85,
    },
    {
        'period_name': 'December 2025',
        'file_suffix': 'dec_2025',
        'dates': ['2025-12-03', '2025-12-09', '2025-12-16', '2025-12-22', '2025-12-29'],
        'growth_factor': 0.95,
    },
    {
        'period_name': 'January 2026',
        'file_suffix': 'jan_2026',
        'dates': ['2026-01-05', '2026-01-11', '2026-01-17', '2026-01-23', '2026-01-28'],
        'growth_factor': 1.05,
    },
    {
        'period_name': 'February 2026',
        'file_suffix': 'feb_2026',
        'dates': ['2026-02-03', '2026-02-10', '2026-02-16', '2026-02-21', '2026-02-26'],
        'growth_factor': 1.18,
    },
]


def generate_monthly_csv_content(preset, month_info, startup_slug):
    """Generates realistic CSV string buffer for a specific month and preset."""
    rows = []
    base = preset['base_sales'] * month_info['growth_factor']
    margin = random.uniform(*preset['margin_range'])
    customers = preset['customers']
    categories = preset['categories']
    dates = month_info['dates']

    # Generate 5 to 7 transactions per month
    for i in range(len(dates)):
        cust_name, cust_email, cust_tier = customers[i % len(customers)]
        cat = categories[i % len(categories)]
        dt = dates[i]

        if cust_tier == 'Enterprise':
            sales = round(random.uniform(base * 0.25, base * 0.40), 2)
        elif cust_tier == 'Mid-Market':
            sales = round(random.uniform(base * 0.12, base * 0.22), 2)
        else:
            sales = round(random.uniform(base * 0.04, base * 0.10), 2)

        cost = round(sales * (1.0 - margin) * random.uniform(0.92, 1.08), 2)
        rows.append([dt, cust_name, cust_email, cust_tier, f"{sales:.2f}", f"{cost:.2f}", cat])

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['date', 'customer_name', 'customer_email', 'customer_segment', 'sales_amount', 'cost_amount', 'category'])
    for r in rows:
        writer.writerow(r)

    return output.getvalue().encode('utf-8')


def seed_statistics_for_all():
    startups = list(Startup.objects.all())
    print(f"\n=======================================================")
    print(f"Starting Seeding of Financial CSVs for {len(startups)} Startups")
    print(f"=======================================================\n")

    total_created = 0
    for s in startups:
        preset = pick_industry_preset(s)
        # Check existing published reports
        existing_count = s.statistics_reports.filter(is_published=True).count()
        if existing_count >= 3:
            print(f"[*] {s.name} ({s.slug}) already has {existing_count} reports. Refreshing AI verdict...")
            reports = list(s.statistics_reports.filter(is_published=True).order_by('created_at'))
        else:
            # Clear any partial or broken records
            s.statistics_reports.all().delete()
            print(f"[+] Seeding 4 monthly financial CSV files for '{s.name}' ({s.slug})...")
            created_reports = []

            for month_info in MONTHS_SEQUENCE:
                csv_bytes = generate_monthly_csv_content(preset, month_info, s.slug)
                filename = f"{s.slug}_{month_info['file_suffix']}.csv"

                report = StartupStatisticsReport(
                    startup=s,
                    uploaded_by=s.owner,
                    original_filename=filename,
                    file_type='csv',
                    reporting_period=month_info['period_name'],
                    is_published=True,
                )
                report.file.save(filename, ContentFile(csv_bytes), save=False)
                report.save()

                # Extract metrics from the saved file
                try:
                    summary = extract_csv_metrics(report.file.path)
                    report.raw_summary = summary
                    report.status = StartupStatisticsReport.STATUS_READY
                    report.save()
                    created_reports.append(report)
                    total_created += 1
                except Exception as ex:
                    print(f"    [!] Error extracting metrics for {filename}: {ex}")

            reports = created_reports

        # Generate and update cached AI Verdict for this startup
        if reports:
            aggregated = aggregate_startup_reports(reports)
            ai_data = generate_fallback_analysis(
                aggregated,
                startup_name=s.name,
                startup_tagline=s.tagline,
                startup_tags=s.tags,
            )

            val_data = ai_data.get('valuation_estimate', {})
            growth_data = ai_data.get('business_growth_percentage', {})

            def _clean_num(v, default=0):
                if v is None: return default
                if isinstance(v, (int, float)): return int(v)
                digits = "".join(c for c in str(v).split('.')[0] if c.isdigit())
                return int(digits) if digits else default

            def _clean_flt(v, default=0.0):
                if v is None: return default
                if isinstance(v, (int, float)): return float(v)
                s_val = "".join(c for c in str(v) if c.isdigit() or c == '.')
                try: return float(s_val) if s_val else default
                except ValueError: return default

            StartupAIVerdict.objects.update_or_create(
                startup=s,
                defaults={
                    'valuation_low': _clean_num(val_data.get('low'), 150000),
                    'valuation_high': _clean_num(val_data.get('high'), 350000),
                    'valuation_multiple': str(val_data.get('multiple') or '4.0x - 6.5x ARR'),
                    'valuation_rationale': str(val_data.get('rationale') or ''),
                    'historical_mom_growth': _clean_flt(growth_data.get('historical_mom_growth'), aggregated.get('mom_growth_rate', 0.0)),
                    'projected_annual_growth': _clean_flt(growth_data.get('projected_annual_growth'), 28.5),
                    'growth_stage': str(growth_data.get('growth_stage') or 'Early Stage Traction'),
                    'future_projections': ai_data.get('future_projections') or [],
                    'investment_verdict': str(ai_data.get('investment_verdict') or 'Growth Trajectory'),
                    'health_score': _clean_num(ai_data.get('health_score'), 82),
                    'executive_summary': str(ai_data.get('executive_summary') or ''),
                    'key_strengths': ai_data.get('key_strengths') or [],
                    'critical_risks': ai_data.get('critical_risks') or [],
                    'actionable_recommendations': ai_data.get('actionable_recommendations') or [],
                    'chart_insights': ai_data.get('chart_insights') or {},
                    'analyzed_files_count': len(reports),
                }
            )
            print(f"    -> AI Verdict generated: Health {ai_data.get('health_score')}/100 | Valuation: ${val_data.get('low', 0):,} - ${val_data.get('high', 0):,}")

    print(f"\n=======================================================")
    print(f"Successfully seeded {total_created} CSV statements across all startups!")
    print(f"All demo users and startups now have published records & AI verdicts.")
    print(f"=======================================================\n")


if __name__ == '__main__':
    seed_statistics_for_all()
