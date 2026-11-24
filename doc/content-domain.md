# Content Domain

eXeLearning projects contain HTML and JavaScript written by authors. By default
the public viewer runs that content in an **opaque origin** on the application
host, which needs no extra infrastructure.

A **content domain** is an optional, stronger setup: author content is served
from a second domain, with one subdomain per content item, so it has a real
origin that is not the application's. Embedded players, browser storage and
Service Workers then work inside the content, and each content item is isolated
from the others.

If you do not set `EXE_CONTENT_DOMAIN`, nothing on this page applies and the
application behaves as it always has.

## What you need

| Requirement | Example |
|---|---|
| A second domain, on a **different site** from the application | `exelearningusercontent.com` for an application at `online.exelearning.net` |
| A wildcard DNS record for it | `*.exelearningusercontent.com` |
| A wildcard TLS certificate | `*.exelearningusercontent.com` |
| A reverse-proxy rule that sends the wildcard host to the same eXeLearning server | see below |

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
single wildcard covers them.

## TLS

A wildcard certificate needs a DNS-01 challenge. With Certbot and a DNS plugin:

```bash
certbot certonly --dns-cloudflare \
  --dns-cloudflare-credentials /etc/letsencrypt/cloudflare.ini \
  -d '*.exelearningusercontent.com'
```

Any provider plugin, or a certificate issued by your organisation, works the
same way.

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
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    }
}
```

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
is what it uses to recognise a content host.

### Caddy

```caddyfile
*.exelearningusercontent.com {
    tls {
        dns cloudflare {env.CF_API_TOKEN}
    }
    reverse_proxy 127.0.0.1:8080
}
```

### Subdirectory installs (`BASE_PATH`)

Content URLs keep the base path:
`https://<label>.exelearningusercontent.com/aplicaciones/medusa/exelearning/content/…`.
Use the same path rule for the content hosts as for the application host.

## Check that it works

1. Enable the public link of a project (Share dialog) and open it.
2. In the browser developer tools, the viewer iframe's `src` starts with
   `https://<41 characters>.exelearningusercontent.com/`.
3. `https://<that host>/login` answers 404: content hosts serve content only.

If the content host cannot be reached, the viewer shows "The content could not
be loaded from the content domain." It does not fall back to the application
host. Check DNS, the certificate and that the proxy forwards the host.

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
