from rest_framework.test import APIClient, APITestCase

from .models import User


class TabAuthenticationTests(APITestCase):
    def test_two_tokens_keep_accounts_separate(self):
        for name in ('Alice', 'Bob'):
            user = User(email=f'{name.lower()}@example.com', first_name=name)
            user.set_password('test-password-123')
            user.save()

        clients = []
        for name in ('Alice', 'Bob'):
            client = APIClient()
            response = client.post('/api/auth/login/', {
                'email': f'{name.lower()}@example.com', 'password': 'test-password-123',
            })
            self.assertEqual(response.status_code, 200)
            client.credentials(HTTP_AUTHORIZATION=f"Token {response.data['token']}")
            clients.append(client)

        self.assertEqual(clients[0].get('/api/auth/me/').data['name'], 'Alice')
        self.assertEqual(clients[1].get('/api/auth/me/').data['name'], 'Bob')
        self.assertEqual(clients[0].get('/api/auth/me/').data['name'], 'Alice')
