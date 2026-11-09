"""Google ID-token verification (AUTH-02).

The frontend uses Google Identity Services, which hands it a signed ID token
(a JWT). We never trust the token's contents until google-auth has verified:
  * the RSA signature against Google's published certs,
  * ``iss`` is accounts.google.com,
  * ``aud`` is *our* OAuth client id,
  * ``exp`` has not passed.
"""
from dataclasses import dataclass

from django.conf import settings
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

VALID_ISSUERS = {'accounts.google.com', 'https://accounts.google.com'}

# google-auth fetches and caches Google's public certs through this session.
_request = google_requests.Request()


class GoogleAuthError(Exception):
    pass


@dataclass(frozen=True)
class GoogleIdentity:
    sub: str
    email: str
    email_verified: bool
    given_name: str
    family_name: str


def verify_google_credential(credential):
    client_id = settings.GOOGLE_OAUTH_CLIENT_ID
    if not client_id:
        raise GoogleAuthError('Google sign-in is not configured.')
    if not credential or not isinstance(credential, str):
        raise GoogleAuthError('Missing Google credential.')

    try:
        # Checks signature, audience and expiry; raises ValueError otherwise.
        claims = id_token.verify_oauth2_token(
            credential, _request, audience=client_id, clock_skew_in_seconds=10,
        )
    except ValueError as exc:
        raise GoogleAuthError('Invalid Google credential.') from exc

    if claims.get('iss') not in VALID_ISSUERS:
        raise GoogleAuthError('Invalid Google credential issuer.')
    if not claims.get('sub') or not claims.get('email'):
        raise GoogleAuthError('Google credential is missing identity claims.')

    return GoogleIdentity(
        sub=claims['sub'],
        email=claims['email'],
        email_verified=bool(claims.get('email_verified')),
        given_name=claims.get('given_name', ''),
        family_name=claims.get('family_name', ''),
    )
