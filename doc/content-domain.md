# Content Domain

eXeLearning projects contain HTML and JavaScript written by authors. By default
the public viewer runs that content in an **opaque origin** on the application
host, which needs no extra infrastructure.

A **content domain** is an optional, stronger setup: author content is served
from a second domain, with one subdomain per content item, so it has a real
origin that is not the application's. Embedded players, browser storage and
Service Workers then work inside the content, and each content item is isolated
from the others.

It applies to two things: the **public viewer** (`/view/…` links) and the
**preview inside the editor**, which otherwise runs author content in the
editor's own origin.

If you do not set `EXE_CONTENT_DOMAIN`, nothing on this page applies and the
application behaves as it always has.

## What you need

| Requirement | Example |
|---|---|
| A second domain, on a **different site** from the application | `exelearningusercontent.com` for an application at `online.exelearning.net` |
| A wildcard DNS record for it | `*.exelearningusercontent.com` |
| A wildcard TLS certificate | `*.exelearningusercontent.com` |
| A reverse-proxy rule that sends the wildcard host to the same eXeLearning server | see below |
| The application served over HTTPS, and aware of it | `TRUSTED_PROXIES` when TLS ends at a proxy |

Then set:

```env
EXE_CONTENT_DOMAIN=exelearningusercontent.com
```

The value is `host[:port]`: no scheme, no path, no `*.`. Add the port only when
the content is served on a non-default port. The content is served with the same
scheme as the application. The server refuses to start if the value is not
valid.

The proxy must pass the original host to eXeLearning: either keep the `Host`
header, or set `X-Forwarded-Host` (overwriting any value the client sent) and
list the proxy in `TRUSTED_PROXIES`. See
[Reverse Proxy Configuration](deployment.md#reverse-proxy-configuration).

The application must also know its own public scheme, because the content is
served with the same one. When TLS ends at a proxy, the proxy must send
`X-Forwarded-Proto` and its address must be in `TRUSTED_PROXIES`. Without that
the application sees plain HTTP, builds `http://` content URLs, and the browser
blocks them as mixed content.

Set every forwarded header that eXeLearning trusts in the proxy itself. A header
that the proxy only passes through lets a client choose the host or the port of
the application origin. When the proxy keeps the `Host` header, the scheme is
the only header the application needs:

```env
TRUSTED_PROXIES=private_ranges
TRUSTED_HEADERS=x-forwarded-proto,x-forwarded-for
```

## Choose a domain on a different site

Use a separate registrable domain, not a subdomain of the application's.

`content.online.exelearning.net` is a different *origin* from
`online.exelearning.net`, but the same *site*, and three protections work per
site:

- **Cookies.** A cookie set for the parent domain is sent to the subdomain, and
  the subdomain can set cookies for the parent domain.
- **SameSite.** Requests from the content to the application count as same-site,
  so the session cookie is sent with them.
- **Process isolation.** Browsers may run two origins of the same site in one
  process.

A subdomain of the application host still works, and the server logs a warning
when it sees one. Do not make the content domain the application host itself or
a parent of it (for example `exelearning.net` for an application at
`online.exelearning.net`): the application would then be treated as a content
host and answer 404.

## DNS

One wildcard record pointing at the reverse proxy:

```text
*.exelearningusercontent.com.  300  IN  A     203.0.113.10
*.exelearningusercontent.com.  300  IN  AAAA  2001:db8::10
```

Content hosts are one label deep (`<label>.exelearningusercontent.com`), so a
single wildcard covers them. The content domain itself
(`exelearningusercontent.com`, without a label) serves nothing and needs no
record.

## TLS

A wildcard certificate needs a DNS-01 challenge: the certificate authority looks
for a TXT record, so the tool that requests the certificate must be able to
write to the DNS zone. With Certbot, use the plugin of your DNS provider. For a
DNS server that accepts dynamic updates (RFC 2136: BIND, Knot, PowerDNS):

```bash
certbot certonly --dns-rfc2136 \
  --dns-rfc2136-credentials /etc/letsencrypt/rfc2136.ini \
  -d '*.exelearningusercontent.com'
```

Certbot has plugins for most providers (`--dns-route53`, `--dns-ovh`,
`--dns-cloudflare`, …), and `acme.sh` and Caddy support the same challenge.
Without API access to the zone,
`certbot certonly --manual --preferred-challenges dns` asks you to create the
TXT record by hand, at every renewal. A certificate issued by your organisation
works the same way.

## Reverse proxy

The content hosts go to the **same** eXeLearning server as the application. The
server decides by host name what to answer, so the proxy only has to pass the
host through.

### Nginx

```nginx
# Application
server {
    listen 443 ssl;
    server_name online.exelearning.net;
    ssl_certificate     /etc/letsencrypt/live/online.exelearning.net/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/online.exelearning.net/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host              $host;
        proxy_set_header X-Forwarded-Host  $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Port  $server_port;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_http_version 1.1;
        proxy_set_header Upgrade    $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

# Content domain
server {
    listen 443 ssl;
    server_name *.exelearningusercontent.com;
    ssl_certificate     /etc/letsencrypt/live/exelearningusercontent.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/exelearningusercontent.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host              $host;
        proxy_set_header X-Forwarded-Host  $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Port  $server_port;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    }
}
```

`$scheme` is the scheme of the connection that reaches Nginx. If another proxy
or a CDN in front of it ends TLS and connects over plain HTTP, `$scheme` is
`http`: forward the scheme that the outer proxy reports instead.

### Apache

```apache
<VirtualHost *:443>
    ServerName content-wildcard.exelearningusercontent.com
    ServerAlias *.exelearningusercontent.com
    SSLEngine on
    SSLCertificateFile    /etc/letsencrypt/live/exelearningusercontent.com/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/exelearningusercontent.com/privkey.pem

    ProxyPreserveHost On
    RequestHeader set X-Forwarded-Proto "https"
    ProxyPass        / http://127.0.0.1:8080/
    ProxyPassReverse / http://127.0.0.1:8080/
</VirtualHost>
```

`ProxyPreserveHost On` passes the original `Host` header to eXeLearning, which
is what it uses to recognise a content host. Apache adds its values to an
`X-Forwarded-Host` header sent by the client instead of replacing it, so use
the `TRUSTED_HEADERS` value shown in [What you need](#what-you-need).

### Caddy

```caddyfile
*.exelearningusercontent.com {
    tls {
        dns cloudflare {env.CF_API_TOKEN}
    }
    reverse_proxy 127.0.0.1:8080
}
```

`cloudflare` is the DNS module used for the certificate challenge; use the one
of your DNS provider.

### Traefik

Add the content hosts to the router of the eXeLearning service. Traefik v3
takes a regular expression:

```text
Host(`online.exelearning.net`) || HostRegexp(`^[a-z0-9]+\.exelearningusercontent\.com$`)
```

Traefik v2 takes a named pattern:

```text
Host(`online.exelearning.net`) || HostRegexp(`{label:[a-z0-9]+}.exelearningusercontent.com`)
```

With Docker Compose (v2 syntax shown):

```yaml
services:
  exelearning:
    environment:
      EXE_CONTENT_DOMAIN: exelearningusercontent.com
      TRUSTED_PROXIES: private_ranges
      TRUSTED_HEADERS: x-forwarded-proto,x-forwarded-for
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.exelearning.rule=Host(`online.exelearning.net`) || HostRegexp(`{label:[a-z0-9]+}.exelearningusercontent.com`)"
```

Traefik keeps the `Host` header. The wildcard certificate comes from a
certificate resolver with a DNS challenge, or from the proxy in front of
Traefik.

### Subdirectory installs (`BASE_PATH`)

Content URLs keep the base path:
`https://<label>.exelearningusercontent.com/aplicaciones/medusa/exelearning/content/…`.
Use the same path rule for the content hosts as for the application host.

## Behind Cloudflare

Cloudflare can provide the wildcard DNS record and the certificate that browsers
see. The reverse-proxy rule on your server is still needed.

1. **Use the content domain as the zone.** The free Universal SSL certificate
   covers `exelearningusercontent.com` and `*.exelearningusercontent.com`, one
   level only. Content hosts are one label below the content domain, so they are
   covered when the content domain is the zone itself. A content domain that is
   a subdomain of the zone (`content.example.org`) needs a certificate from
   Advanced Certificate Manager, or a DNS-only record and your own certificate.
2. **DNS → Records:** add one proxied record named `*`: type `A` or `AAAA` with
   the address of your server, or `CNAME` with its name.
3. **SSL/TLS → Overview:** set the encryption mode to **Full (strict)**. The
   server then needs a certificate for `*.exelearningusercontent.com` that
   Cloudflare accepts: a public one (see [TLS](#tls)) or a Cloudflare Origin CA
   certificate, which is free, lasts up to 15 years and is trusted by Cloudflare
   only. To get one, create a key and a request on the server:

    ```bash
    openssl req -new -newkey rsa:2048 -nodes \
      -keyout exelearningusercontent.com.key \
      -out exelearningusercontent.com.csr \
      -subj '/CN=exelearningusercontent.com' \
      -addext 'subjectAltName=DNS:*.exelearningusercontent.com,DNS:exelearningusercontent.com'
    ```

    In **SSL/TLS → Origin Server → Create Certificate** choose "Use my private
    key and CSR", paste the request, and save the certificate that Cloudflare
    returns next to the key. Use both in the `server` block of the content
    domain shown in [Nginx](#nginx).

4. **SSL/TLS → Edge Certificates:** turn on **Always Use HTTPS**.
5. **Security → Settings:** turn off **Email Address Obfuscation**, which is on
   by default. It rewrites e-mail addresses in the HTML of the content and adds
   a script to it. For the same reason leave Rocket Loader off and do not enable
   the automatic Web Analytics snippet for this zone: the content must reach
   the browser as the author wrote it.

Cloudflare does not cache the content: the responses carry
`Cache-Control: no-store`.

If the zone of the **application** uses the Flexible encryption mode, Cloudflare
connects to your server over plain HTTP. The proxy there must forward the scheme
that Cloudflare reports (`X-Forwarded-Proto` or `CF-Visitor`) instead of its
own, and accept connections from Cloudflare only. Full (strict) avoids this.

## Several installations

A wildcard record points at one server, so two installations cannot use the
same content domain. Each installation needs its own:

- a domain registered for it, or
- a subdomain of a shared domain, delegated to it. With
  `EXE_CONTENT_DOMAIN=canarias.exelearningusercontent.com` the content is served
  from `<label>.canarias.exelearningusercontent.com`. The owner of the shared
  domain adds `NS` records for `canarias`, and the installation manages the
  wildcard record and the certificate (`*.canarias.exelearningusercontent.com`)
  in the delegated zone.

Either way the content domain must be on a different site from the application.

## Check that it works

1. Enable the public link of a project (Share dialog) and open it.
2. In the browser developer tools, the viewer iframe's `src` starts with
   `https://<41 characters>.exelearningusercontent.com/`.
3. `https://<that host>/login` answers 404: content hosts serve content only.
4. Open the preview panel in the editor. Its iframe is on a
   `https://<41 characters>.exelearningusercontent.com/` host too.

From a terminal:

```bash
# The viewer page embeds a content URL, and it starts with https://
curl -s https://online.exelearning.net/view/<public view id> \
  | grep -oE 'https?://[a-z0-9]+\.exelearningusercontent\.com[^"]*'

# The content answers 200, with a Content-Security-Policy and without Set-Cookie
# (a GET request: content hosts answer 404 to any other method, HEAD included)
curl -s -o /dev/null -D - '<content URL>'

# Nothing else answers on a content host
curl -s -o /dev/null -w '%{http_code}\n' 'https://<content host>/login'   # 404
```

If the content host cannot be reached, the viewer shows "The content could not
be loaded from the content domain." It does not fall back to the application
host.

## Troubleshooting

| Symptom | Cause | What to do |
|---|---|---|
| The content does not load and its URL starts with `http://` | The application does not know it is served over HTTPS | Send `X-Forwarded-Proto` from the proxy that ends TLS and list that proxy in `TRUSTED_PROXIES` |
| The content URL carries a host or a port that is not the public one | A forwarded header reaches the application as the client sent it | Set the header in the proxy, or restrict `TRUSTED_HEADERS` |
| Every content URL answers 404 | The proxy replaces the `Host` header | Keep `Host`, or set `X-Forwarded-Host` and list the proxy in `TRUSTED_PROXIES` |
| The content host shows another site or a certificate warning | No proxy rule or no certificate for the wildcard host | Add the rule for `*.<content domain>` and the wildcard certificate |
| The application itself answers 404 | The content domain is the application host or a parent of it | Use a domain on a different site |
| Cloudflare error 526 | Full (strict), and the certificate on the server is not valid for the content hosts | Install a certificate for `*.<content domain>` on the server |
| E-mail addresses in the content are replaced and a script from `/cdn-cgi/` appears | Cloudflare Email Address Obfuscation | Turn it off for the content zone |

## What changes for the content

| | Without a content domain | With a content domain |
|---|---|---|
| Origin of the content | opaque (`null`) | `https://<label>.<content domain>` |
| Embedded players (YouTube, Vimeo, …) | run sandboxed in an opaque origin; some refuse to play | run in their own origin |
| `localStorage`, IndexedDB, Service Workers | not available | available, separate for each content item |
| Access to the application session, cookies, API or page | none | none |

## Try it locally

Browsers resolve every `*.localhost` name to the loopback address, and treat
`a.localhost` and `b.localhost` as different sites:

```bash
EXE_CONTENT_DOMAIN=exe-content.localhost:8080 PUBLIC_VIEW_ENABLED=true make up-local
```

(or add both variables to `.env`; use the port your server listens on).

Open `http://exe-app.localhost:8080`, publish a project and open its public
link. The content loads from `http://<label>.exe-content.localhost:8080`.

## What changes in the editor

- The preview panel loads from `https://<label>.<content domain>`, one origin per
  project. Scripts in the content cannot read the editor page, its cookies or
  its storage.
- "Open in new tab" opens an empty page of the editor (`/preview-tab.html`) with
  the preview inside it, on the same content origin as in the panel. The tab is
  updated whenever the preview is refreshed, and it can be reloaded while the
  editor stays open. Opened without the editor, that address shows nothing.
- The print preview is not moved to the content domain.
- If the content domain cannot be reached, the preview shows an error. It does
  not fall back to the editor's origin.

## Limits

- Labels are derived from the server signing secret (`API_JWT_SECRET`). Rotating
  it changes every content origin; whatever content stored in the browser under
  the old origin is no longer reachable.
- All instances of a deployment must share `API_JWT_SECRET`, as they already do
  for sessions.
- Two content items are different origins but the same site unless the content
  domain is in the [Public Suffix List](https://publicsuffix.org/). Origin
  isolation (page, storage, Service Workers) does not depend on that.
- LMS and CMS plugins, the desktop app and the static build do not use the
  content domain.
