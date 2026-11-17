"""
Analytics & AI System - Comprehensive Evaluation Test Suite
Location: backend/statistics_app/test_analytics_evaluation.py

This test file verifies and evaluates:
1. Financial Data Extraction & Aggregation Algorithms:
   - CSV number cleansing, dirty currency symbols, and multi-header resolution
   - Multi-period chronological consolidation and deduplication
   - Month-over-Month (MoM) growth calculations
2. AI Valuation, Projections & Verdict Heuristics:
   - Valuation multiple determination (Revenue vs Profit Multiple based on margin and growth)
   - 4-Quarter forward projection financial modeling (leveraged cost vs revenue trajectory)
   - Health score & SWOT generation
3. Universal Access & Role-Based Permissions:
   - Universal public reading of company financials & AI verdicts
   - Public company discovery & reporting flags
   - Owner-only upload & publication controls
   - Owner-only deletion controls
4. UI Contract & Integration Consistency:
   - Data contracts for Manage Startup (FounderDashboard), Business Profile (Profile), and AI Research (Statistics)
"""

import os
import tempfile
import pandas as pd
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase

from accounts.models import User
from startups.models import Startup
from statistics_app.models import StartupStatisticsReport, StartupAIVerdict
from statistics_app.services.data_extractor import extract_csv_metrics, aggregate_startup_reports, _clean_number
from statistics_app.services.ai_analyzer import generate_fallback_analysis, analyze_with_deepseek

PW = 'c0rrect-Horse-battery'


class AnalyticsDataExtractionEvaluationTests(APITestCase):
    """Evaluates CSV parsing, number sanitation, and mathematical accuracy."""

    def test_clean_number_sanitation(self):
        """Verify robust string-to-float conversion across global currency symbols and comma separators."""
        test_cases = [
            ("$12,500.50", 12500.50),
            ("€4,200.00", 4200.00),
            ("£999.99", 999.99),
            (" 50000 ", 50000.0),
            ("invalid", 0.0),
            (None, 0.0),
            (1500, 1500.0),
            (2500.75, 2500.75),
        ]
        for raw_val, expected in test_cases:
            with self.subTest(raw_val=raw_val):
                self.assertEqual(_clean_number(raw_val), expected)

    def test_csv_extraction_with_diverse_headers_and_dirty_numbers(self):
        """Verify metric extraction correctly parses varied column aliases and computes margins accurately."""
        csv_data = (
            "Date,Client Name,Total Revenue,COGS,Department\n"
            "2026-01-05,Alpha Corp,\"$10,000.00\",\"$3,000.00\",Enterprise\n"
            "2026-01-20,Beta LLC,\"$20,000.00\",\"$5,000.00\",Mid-Market\n"
            "2026-02-10,Alpha Corp,\"$15,000.00\",\"$4,000.00\",Enterprise\n"
        )
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as tf:
            tf.write(csv_data)
            temp_path = tf.name

        try:
            metrics = extract_csv_metrics(temp_path)
            self.assertEqual(metrics['total_sales'], 45000.00)
            self.assertEqual(metrics['total_costs'], 12000.00)
            self.assertEqual(metrics['net_profit'], 33000.00)
            # Margin = (33000 / 45000) * 100 = 73.33%
            self.assertAlmostEqual(metrics['profit_margin'], 73.33, places=1)
            # 2 unique customers: Alpha Corp ($25k) and Beta LLC ($20k)
            self.assertEqual(metrics['total_customers'], 2)
            self.assertEqual(metrics['top_customers'][0]['name'], 'Alpha Corp')
            self.assertEqual(metrics['top_customers'][0]['spend'], 25000.00)
            # Monthly timeline contains Jan 2026 and Feb 2026
            self.assertEqual(len(metrics['monthly_timeline']), 2)
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

    def test_multi_report_aggregation_and_mom_growth(self):
        """Evaluate chronological consolidation across multiple monthly reports and MoM growth rate."""
        report_1 = {
            'raw_summary': {
                'total_sales': 10000.0,
                'total_costs': 3000.0,
                'monthly_timeline': [
                    {'period': 'Jan 2026', 'sales': 10000.0, 'costs': 3000.0, 'profit': 7000.0}
                ],
                'top_customers': [{'name': 'Acme', 'spend': 10000.0}],
                'category_breakdown': [{'name': 'SaaS', 'amount': 10000.0}],
            }
        }
        report_2 = {
            'raw_summary': {
                'total_sales': 15000.0,
                'total_costs': 4000.0,
                'monthly_timeline': [
                    {'period': 'Feb 2026', 'sales': 15000.0, 'costs': 4000.0, 'profit': 11000.0}
                ],
                'top_customers': [{'name': 'Acme', 'spend': 5000.0}, {'name': 'Beta', 'spend': 10000.0}],
                'category_breakdown': [{'name': 'SaaS', 'amount': 15000.0}],
            }
        }

        aggregated = aggregate_startup_reports([report_1, report_2])
        self.assertEqual(aggregated['total_sales'], 25000.0)
        self.assertEqual(aggregated['total_costs'], 7000.0)
        self.assertEqual(aggregated['net_profit'], 18000.0)
        self.assertEqual(len(aggregated['monthly_timeline']), 2)
        # MoM growth from Jan ($10k) to Feb ($15k) is 50.0%
        self.assertEqual(aggregated['mom_growth_rate'], 50.0)
        # Acme total spend across both reports = $15k
        top_cust = {c['name']: c['spend'] for c in aggregated['top_customers']}
        self.assertEqual(top_cust['Acme'], 15000.0)


class AnalyticsAIEvaluationTests(APITestCase):
    """Evaluates the AI valuation, forward projections, health score, and verdict generation."""

    def test_ai_verdict_valuation_and_forward_projections(self):
        """Evaluate valuation multiple heuristics and forward quarter projection calculations."""
        mock_summary = {
            'total_sales': 120000.0,
            'total_costs': 36000.0,
            'net_profit': 84000.0,
            'profit_margin': 70.0,
            'total_customers': 15,
            'mom_growth_rate': 25.0,
            'monthly_timeline': [
                {'period': 'Jan 2026', 'sales': 35000.0, 'costs': 11000.0, 'profit': 24000.0},
                {'period': 'Feb 2026', 'sales': 40000.0, 'costs': 12000.0, 'profit': 28000.0},
                {'period': 'Mar 2026', 'sales': 45000.0, 'costs': 13000.0, 'profit': 32000.0},
            ],
            'top_customers': [{'name': 'Client A', 'spend': 30000.0, 'share_pct': 25.0}],
        }

        verdict = generate_fallback_analysis(mock_summary, "Apex Cloud")

        # 1. Valuation assertions
        val = verdict['valuation_estimate']
        self.assertGreater(val['low'], 0)
        self.assertGreater(val['high'], val['low'])
        self.assertTrue('x' in val['multiple'].lower())
        self.assertTrue(len(val['rationale']) > 10)

        # 2. Growth percentage assertions
        growth = verdict['business_growth_percentage']
        self.assertEqual(growth['historical_mom_growth'], 25.0)
        self.assertGreater(growth['projected_annual_growth'], 0)
        self.assertIn(growth['growth_stage'], ['Early Traction', 'High-Growth Scaleup', 'Steady Operating', 'Seed / Pre-Revenue'])

        # 3. Future Projections (4 Quarters)
        projections = verdict['future_projections']
        self.assertEqual(len(projections), 4)
        for i, q in enumerate(projections):
            self.assertIn('period', q)
            self.assertGreater(q['sales'], 0)
            self.assertGreater(q['costs'], 0)
            self.assertEqual(round(q['sales'] - q['costs'], 2), q['profit'])
            if i > 0:
                # Revenue should project upward in high growth
                self.assertGreater(q['sales'], projections[i - 1]['sales'])

        # 4. Scorecard & SWOT
        self.assertGreaterEqual(verdict['health_score'], 0)
        self.assertLessEqual(verdict['health_score'], 100)
        self.assertTrue(len(verdict['investment_verdict']) > 0)
        self.assertTrue(len(verdict['executive_summary']) > 0)
        self.assertGreaterEqual(len(verdict['key_strengths']), 1)
        self.assertGreaterEqual(len(verdict['critical_risks']), 1)
        self.assertGreaterEqual(len(verdict['actionable_recommendations']), 1)


class AnalyticsUniversalAccessEvaluationTests(APITestCase):
    """Evaluates security, permissions, and universal accessibility of the new analytics workflow."""

    @classmethod
    def setUpTestData(cls):
        cls.founder = User.objects.create_user('founder_howard@example.com', PW, first_name='Howard')
        cls.investor = User.objects.create_user('investor_sarah@example.com', PW, first_name='Sarah')
        cls.stranger = User.objects.create_user('stranger_bob@example.com', PW, first_name='Bob')

    def setUp(self):
        self.startup = Startup.objects.create(
            slug='howard-robotics',
            name='Howard Robotics',
            owner=self.founder,
            goal=100_000,
            raised=35_000,
            status='open',
            review_status=Startup.REVIEW_APPROVED,
        )

        # Create published financial statement
        csv_body = b"date,sales_amount,cost_amount\n2026-01-01,25000,8000\n2026-02-01,30000,9000\n"
        up_file = SimpleUploadedFile("jan_feb.csv", csv_body, content_type="text/csv")
        self.report = StartupStatisticsReport.objects.create(
            startup=self.startup,
            uploaded_by=self.founder,
            file=up_file,
            original_filename="jan_feb.csv",
            file_type="csv",
            reporting_period="Jan - Feb 2026",
            is_published=True,
            raw_summary={
                'total_sales': 55000.0,
                'total_costs': 17000.0,
                'net_profit': 38000.0,
                'profit_margin': 69.1,
                'mom_growth_rate': 20.0,
                'total_customers': 4,
                'monthly_timeline': [
                    {'period': 'Jan 2026', 'sales': 25000.0, 'costs': 8000.0, 'profit': 17000.0},
                    {'period': 'Feb 2026', 'sales': 30000.0, 'costs': 9000.0, 'profit': 21000.0},
                ],
            }
        )

    def test_universal_public_can_view_published_reports(self):
        """Unauthenticated visitors and investors can read all published financial reports."""
        # Anonymous visitor
        res = self.client.get(f'/api/statistics/?startup={self.startup.slug}')
        self.assertEqual(res.status_code, 200)
        items = res.data if isinstance(res.data, list) else res.data.get('results', [])
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]['reporting_period'], 'Jan - Feb 2026')
        self.assertIn('file_url', items[0])

        # Authenticated investor
        self.client.force_authenticate(self.investor)
        res_inv = self.client.get(f'/api/statistics/?startup={self.startup.slug}')
        self.assertEqual(res_inv.status_code, 200)

    def test_universal_public_ai_research_endpoint(self):
        """Any visitor or investor can trigger AI Research on any company by slug."""
        # Anonymous visitor
        res_anon = self.client.get(f'/api/statistics/research/?startup={self.startup.slug}')
        self.assertEqual(res_anon.status_code, 200)
        self.assertIn('startup', res_anon.data)
        self.assertIn('verdict', res_anon.data)
        self.assertIn('aggregated_summary', res_anon.data)
        self.assertIn('published_reports', res_anon.data)

        # Authenticated investor
        self.client.force_authenticate(self.investor)
        res_inv = self.client.get(f'/api/statistics/research/?startup={self.startup.slug}')
        self.assertEqual(res_inv.status_code, 200)
        verdict = res_inv.data['verdict']
        self.assertGreater(verdict['valuation_high'], 0)
        self.assertEqual(len(verdict['future_projections']), 4)

    def test_company_search_endpoint_contract(self):
        """Search endpoint returns companies with publication flags for quick UI lookup."""
        res = self.client.get('/api/statistics/search-companies/?q=Howard')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 1)
        item = res.data[0]
        self.assertEqual(item['slug'], 'howard-robotics')
        self.assertTrue(item['has_reports'])
        self.assertEqual(item['reports_count'], 1)

    def test_owner_controls_upload_and_delete(self):
        """Only the verified startup owner can upload new monthly reports or delete existing ones."""
        # Stranger attempts upload -> 403 Forbidden
        self.client.force_authenticate(self.stranger)
        csv_up = SimpleUploadedFile("fake.csv", b"date,sales_amount\n2026-03-01,100\n", content_type="text/csv")
        res_bad_upload = self.client.post('/api/statistics/', {
            'startup_slug': self.startup.slug,
            'file': csv_up,
        })
        self.assertEqual(res_bad_upload.status_code, 403)

        # Stranger attempts delete -> 403 Forbidden
        res_bad_delete = self.client.delete(f'/api/statistics/{self.report.id}/')
        self.assertEqual(res_bad_delete.status_code, 403)
        self.assertTrue(StartupStatisticsReport.objects.filter(id=self.report.id).exists())

        # Verified Founder uploads new statement -> 201 Created
        self.client.force_authenticate(self.founder)
        csv_valid = SimpleUploadedFile("march.csv", b"date,sales_amount,cost_amount\n2026-03-01,35000,10000\n", content_type="text/csv")
        res_good_upload = self.client.post('/api/statistics/', {
            'startup_slug': self.startup.slug,
            'file': csv_valid,
            'reporting_period': 'March 2026',
        })
        self.assertEqual(res_good_upload.status_code, 201)
        self.assertEqual(res_good_upload.data['reporting_period'], 'March 2026')
        new_report_id = res_good_upload.data['id']

        # Verified Founder deletes report -> 204 No Content
        res_good_delete = self.client.delete(f'/api/statistics/{new_report_id}/')
        self.assertEqual(res_good_delete.status_code, 204)
        self.assertFalse(StartupStatisticsReport.objects.filter(id=new_report_id).exists())
