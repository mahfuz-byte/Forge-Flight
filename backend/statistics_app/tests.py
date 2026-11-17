import io
from rest_framework.test import APITestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from accounts.models import User
from startups.models import Startup
from statistics_app.models import StartupStatisticsReport, StartupAIVerdict

PW = 'c0rrect-Horse-battery'


class StatisticsAppTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = User.objects.create_user('founder@example.com', PW, first_name='Howard')
        cls.investor = User.objects.create_user('investor@example.com', PW, first_name='Ivy')
        cls.other_user = User.objects.create_user('other@example.com', PW, first_name='Otto')

    def setUp(self):
        self.startup = Startup.objects.create(
            slug='howard-tech',
            name='Howard Tech',
            owner=self.owner,
            goal=50_000,
            raised=10_000,
            status='open',
            review_status=Startup.REVIEW_APPROVED,
        )

        # Create a published report
        csv_content = (
            "date,customer_name,customer_email,customer_segment,sales_amount,cost_amount,category\n"
            "2026-01-10,Acme Corp,contact@acme.com,Enterprise,12000.00,3000.00,Software\n"
            "2026-02-14,TechNova,info@technova.io,Mid-Market,16000.00,4000.00,Cloud\n"
        ).encode('utf-8')
        uploaded = SimpleUploadedFile("howard_jan_feb.csv", csv_content, content_type="text/csv")

        self.report = StartupStatisticsReport.objects.create(
            startup=self.startup,
            uploaded_by=self.owner,
            file=uploaded,
            original_filename="howard_jan_feb.csv",
            file_type="csv",
            reporting_period="Q1 2026",
            is_published=True,
            raw_summary={
                "total_sales": 28000.0,
                "total_costs": 7000.0,
                "net_profit": 21000.0,
                "profit_margin": 75.0,
                "total_customers": 2,
                "arpu": 14000.0,
                "top_customers": [{"name": "TechNova", "spend": 16000.0, "share_pct": 57.1}],
                "monthly_timeline": [
                    {"period": "Jan 2026", "sales": 12000.0, "costs": 3000.0, "profit": 9000.0},
                    {"period": "Feb 2026", "sales": 16000.0, "costs": 4000.0, "profit": 12000.0},
                ],
                "mom_growth_rate": 33.3,
                "rows_count": 2,
            }
        )

    def test_public_unauthenticated_user_can_read_published_statistics(self):
        """Anyone (including unauthenticated visitors) can read published statistics for a startup."""
        res = self.client.get(f'/api/statistics/?startup={self.startup.slug}')
        self.assertEqual(res.status_code, 200)
        data = res.data if isinstance(res.data, list) else res.data.get('results', [])
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['original_filename'], 'howard_jan_feb.csv')
        self.assertEqual(data[0]['raw_summary']['total_sales'], 28000.0)

    def test_unauthenticated_user_cannot_upload_statistics(self):
        """Unauthenticated requests to upload statistics are rejected."""
        csv_file = SimpleUploadedFile("test.csv", b"date,sales_amount\n2026-01-01,500\n", content_type="text/csv")
        res = self.client.post('/api/statistics/', {'startup_slug': self.startup.slug, 'file': csv_file})
        self.assertIn(res.status_code, (401, 403))

    def test_non_owner_cannot_upload_statistics(self):
        """A user who is not the startup owner cannot upload statistics for that startup."""
        self.client.force_authenticate(self.investor)
        csv_file = SimpleUploadedFile("test.csv", b"date,sales_amount\n2026-01-01,500\n", content_type="text/csv")
        res = self.client.post('/api/statistics/', {'startup_slug': self.startup.slug, 'file': csv_file})
        self.assertEqual(res.status_code, 403)

    def test_owner_can_upload_and_publish_monthly_statistics(self):
        """Startup owner can upload monthly CSV files in Manage Startup -> Analytics."""
        self.client.force_authenticate(self.owner)
        csv_content = (
            "date,customer_name,sales_amount,cost_amount\n"
            "2026-03-01,Global Health,22000,5000\n"
        ).encode('utf-8')
        csv_file = SimpleUploadedFile("march_report.csv", csv_content, content_type="text/csv")
        res = self.client.post('/api/statistics/', {
            'startup_slug': self.startup.slug,
            'file': csv_file,
            'reporting_period': 'March 2026',
        })
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data['original_filename'], 'march_report.csv')
        self.assertEqual(res.data['reporting_period'], 'March 2026')
        self.assertTrue(res.data['is_published'])
        self.assertEqual(res.data['raw_summary']['total_sales'], 22000.0)

    def test_owner_can_delete_their_report(self):
        """Startup owner can delete an outdated or incorrect financial report."""
        self.client.force_authenticate(self.owner)
        res = self.client.delete(f'/api/statistics/{self.report.id}/')
        self.assertEqual(res.status_code, 204)
        self.assertFalse(StartupStatisticsReport.objects.filter(id=self.report.id).exists())

    def test_non_owner_cannot_delete_report(self):
        """Non-owners are blocked from deleting reports."""
        self.client.force_authenticate(self.other_user)
        res = self.client.delete(f'/api/statistics/{self.report.id}/')
        self.assertEqual(res.status_code, 403)
        self.assertTrue(StartupStatisticsReport.objects.filter(id=self.report.id).exists())

    def test_universal_ai_research_endpoint(self):
        """Any user (investor, owner, or public) can query the research endpoint to get AI valuation & projections."""
        self.client.force_authenticate(self.investor)
        res = self.client.get(f'/api/statistics/research/?startup={self.startup.slug}')
        self.assertEqual(res.status_code, 200)

        # Verify response structure
        self.assertIn('startup', res.data)
        self.assertEqual(res.data['startup']['name'], 'Howard Tech')

        self.assertIn('verdict', res.data)
        verdict = res.data['verdict']
        self.assertGreater(verdict['valuation_low'], 0)
        self.assertGreater(verdict['valuation_high'], verdict['valuation_low'])
        self.assertIn('future_projections', verdict)
        self.assertEqual(len(verdict['future_projections']), 4)
        self.assertIn('investment_verdict', verdict)
        self.assertIn('executive_summary', verdict)

        # Verify published reports attached to verdict
        self.assertIn('published_reports', res.data)
        self.assertEqual(len(res.data['published_reports']), 1)
        self.assertEqual(res.data['published_reports'][0]['original_filename'], 'howard_jan_feb.csv')

    def test_search_companies_endpoint(self):
        """Search companies endpoint returns matches and report indicators."""
        res = self.client.get('/api/statistics/search-companies/?q=howard')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 1)
        item = res.data[0]
        self.assertEqual(item['slug'], 'howard-tech')
        self.assertEqual(item['name'], 'Howard Tech')
        self.assertTrue(item['has_reports'])
        self.assertEqual(item['reports_count'], 1)

    def test_sample_csv_endpoint(self):
        """Sample CSV is downloadable without authentication."""
        res = self.client.get('/api/statistics/sample-csv/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res['Content-Type'], 'text/csv')
        self.assertIn(b'sales_amount', res.content)
