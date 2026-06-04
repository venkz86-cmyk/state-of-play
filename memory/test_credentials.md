# Test Credentials

> Auth uses Ghost Members magic-link via `/api/ghost/verify-member`.
> No password — verification is by email lookup against the Ghost Members API.
> A real paid member's email is required to verify the live `/login` and `/account` flows.

## Member account (to test paid member experience)
- Email: `venkz86@gmail.com` (publisher's own account — known paid member, used in previous mockup placeholder)
- Method: enter email at `/login` → calls `/api/ghost/verify-member` → if paid in Ghost, sets localStorage `tsop_member` and routes to `/account`

## To test the "not a member" flow
- Any random email not registered in Ghost will surface the "Email not found. Please subscribe first." error

## Razorpay
- Test the click → checkout popup in a normal browser (Playwright headless blocks the modal)
- India IP → `pl_ROAFZZjAvjHhfQ` (₹2,949 / Subscribe Now)
- International IP → `pl_ROAIM0inFWbpC2` ($120 / Subscribe Now)
