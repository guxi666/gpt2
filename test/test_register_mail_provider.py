import unittest
from unittest.mock import patch

from services.register import mail_provider


class CloudflareTempDomainTests(unittest.TestCase):
    def test_resolve_cloudflare_temp_domain_keeps_plain_domain_when_disabled(self) -> None:
        self.assertEqual(
            mail_provider._resolve_cloudflare_temp_domain("example.test", False),
            "example.test",
        )

    def test_resolve_cloudflare_temp_domain_adds_random_prefix_when_enabled(self) -> None:
        with patch.object(mail_provider, "_random_subdomain_label", return_value="randbox"):
            self.assertEqual(
                mail_provider._resolve_cloudflare_temp_domain("example.test", True),
                "randbox.example.test",
            )

    def test_resolve_cloudflare_temp_domain_expands_wildcard_even_without_switch(self) -> None:
        with patch.object(mail_provider, "_random_subdomain_label", return_value="randbox"):
            self.assertEqual(
                mail_provider._resolve_cloudflare_temp_domain("*.example.test", False),
                "randbox.example.test",
            )

    def test_cloudflare_temp_provider_uses_resolved_domain_in_create_mailbox(self) -> None:
        provider = mail_provider.CloudflareTempMailProvider(
            {
                "api_base": "https://webmail.example.test",
                "admin_password": "secret",
                "domain": ["example.test"],
                "random_subdomain": True,
            },
            {"request_timeout": 15, "wait_timeout": 30, "wait_interval": 3, "user_agent": "test-agent", "proxy": ""},
        )
        with patch.object(mail_provider, "_random_subdomain_label", return_value="randbox"), patch.object(
            provider,
            "_request",
            return_value={"address": "user@randbox.example.test", "jwt": "mail-token"},
        ) as request_mock:
            mailbox = provider.create_mailbox("user")
        self.assertEqual(mailbox["address"], "user@randbox.example.test")
        self.assertEqual(mailbox["token"], "mail-token")
        self.assertEqual(request_mock.call_args.kwargs["payload"]["domain"], "randbox.example.test")


if __name__ == "__main__":
    unittest.main()
