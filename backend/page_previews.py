"""Link previews for the site's pages that aren't stories.

Vercel sends link-preview bots (WhatsApp, LinkedIn, X...) to /api/og/{path}
and search bots to /api/story/{path}. Its rule is meant to skip pages like
/about, but in practice every page reaches the backend, which used to treat
each one as a story and fall back to an image from the first version of the
site. page_meta() gives each page its own title, description and card
(frontend/public/og/*.png), so the preview matches the page.
"""
from typing import Optional

SITE = 'https://www.stateofplay.club'
DEFAULT_IMAGE = f'{SITE}/og-default.png'


def _card(name: str) -> str:
    return f'{SITE}/og/{name}.png'


SUBSCRIBE = 'Subscribe to The State of Play, India’s sports business publication: one reported story a week and the full archive.'

# path -> (title, description, image)
PAGES = {
    '': ('The State of Play', "India's sports business publication. Reportage, analysis and intelligence from sport's most consequential rooms, written for the people who run the game.", DEFAULT_IMAGE),
    'about': ('About', 'About The State of Play, a sports business publication out of Bengaluru, reporting on the money and the people shaping Indian sport.', _card('about')),
    'contact': ('Contact', 'Get in touch with The State of Play about memberships or partnerships.', _card('contact')),
    'state-of-play': ('Latest', "The latest reportage and analysis from The State of Play, India's sports business desk.", _card('stories')),
    'archive': ('Archive', 'Every story The State of Play has published, by month and by year.', _card('stories')),
    'search': ('Search', 'Search every story The State of Play has published.', _card('stories')),
    'season-one': ('Season One', 'Every story in Season One of The State of Play, the publication on the business of Indian sport.', _card('season-one')),
    'start-here': ('Start here', 'Where to begin with The State of Play: the stories to read first.', _card('start-here')),
    'left-field': ('The Left Field', 'The Left Field: free news briefs on the deals and people moving Indian sport, twice a week.', _card('left-field')),
    'outfield': ('The Outfield', 'The Outfield: The State of Play’s in-person events on the business of Indian sport. Small rooms, off the record.', _card('outfield')),
    'partnerships': ('Partnerships', 'Partner with The State of Play: a small number of partners each year, alongside an audience of investors and executives in Indian sport.', _card('partnerships')),
    'renew': ('Renew your membership', 'A note from Venkat Ananth to members of The State of Play at the end of their first year.', _card('renew')),
    'signup': ('Subscribe', SUBSCRIBE, _card('signup')),
    'membership': ('Subscribe', SUBSCRIBE, _card('signup')),
    'subscribe': ('Subscribe', SUBSCRIBE, _card('signup')),
    'trial': ('The Ten', 'Ten of The State of Play’s most recent stories on the business of Indian sport, for ₹590. Stay the month and everything new is yours too.', _card('trial')),
    'students': ('Student plan', 'The State of Play for currently enrolled students: the same weekly reporting and full archive as the annual plan, at a student price.', _card('students')),
    'teams': ('Teams & Newsrooms', 'Give your team a working view of Indian sport. Team plans for consulting and law firms, agencies, broadcasters, investors, analysts, franchises and operators.', _card('teams')),
    'gift': ('Gift a Subscription', 'Give someone a year of The State of Play: reported stories on the business of Indian sport, delivered weekly.', _card('gift')),
    'app': ('On your phone', 'Add The State of Play to your phone and get a notification when a story is published or a new edition of The Left Field is out.', _card('app')),
    'mixed-zone': ('Mixed Zone', 'Short notes from Venkat Ananth for annual members of The State of Play.', DEFAULT_IMAGE),
    'terms': ('Terms', 'The State of Play: terms of use, subscription terms, and refund policy.', DEFAULT_IMAGE),
    'privacy': ('Privacy', 'How The State of Play collects, stores, and uses information about its readers and subscribers.', DEFAULT_IMAGE),
    'login': ('Sign in', 'Sign in to The State of Play.', DEFAULT_IMAGE),
}
# Pages that only mean something to the person signed in.
for _p in ('account', 'dashboard', 'welcome', 'you'):
    PAGES[_p] = ('Your account', 'Your membership of The State of Play.', DEFAULT_IMAGE)
# Pages under another page share its preview.
SUBPAGES = {'students/pay', 'teams/manage', 'teams/login', 'gift/redeem'}

# Kept out of search results (personal or members-only pages).
NOINDEX = {'account', 'dashboard', 'welcome', 'you', 'login', 'mixed-zone', 'invite', 'admin'}


def _meta(path: str, title: str, description: str, image: str, kind: str = 'website') -> dict:
    return {
        'url': f'{SITE}/{path}' if path else f'{SITE}/',
        'title': title, 'description': description, 'image': image, 'type': kind,
    }


async def page_meta(path: str, db=None, strict: bool = False) -> Optional[dict]:
    """Preview for a non-story path (no leading or trailing slash), or None
    when the path should be treated as a story slug. strict leaves paths
    that aren't pages (scanners asking for /.env and the like) to the
    caller's not-found."""
    path = (path or '').strip('/')
    head, _, rest = path.partition('/')
    if path in PAGES:
        return _meta(path, *PAGES[path])
    if path in SUBPAGES:
        return _meta(head, *PAGES[head])
    if head == 'topic' and rest:
        name = rest.split('/')[0].replace('-', ' ').title()
        return _meta(path, name, f'Every story The State of Play has published on {name}.', _card('stories'))
    if head == 'invite' and rest:
        return _meta(path, 'An invitation', 'An invitation to read The State of Play, the publication on the business of Indian sport.', _card('signup'))
    if head == 'left-field' and rest:
        kind, _, slug = rest.partition('/')
        if kind == 'e' and slug and db is not None:
            try:
                d = await db.lf_editions.find_one({'_id': slug}, {'title': 1, 'image': 1, 'subtitle': 1})
            except Exception:
                d = None
            if d:
                return _meta(path, d.get('title') or 'The Left Field',
                             d.get('subtitle') or PAGES['left-field'][1],
                             d.get('image') or _card('left-field'), 'article')
        return _meta(path, *PAGES['left-field'])
    if not strict and ('/' in path or '.' in path):
        # Not a story slug (stories are single segments without dots).
        return _meta('', *PAGES[''])
    return None
