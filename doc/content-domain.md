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

There are two ways to get one:

- **Your own content domain** (`EXE_CONTENT_DOMAIN`): a wildcard DNS record, a
  wildcard certificate and a reverse-proxy rule send `*.<your domain>` to your
  eXeLearning server. Nobody else takes part. Most of this page is about it.
- **A content proxy** (`EXE_CONTENT_PROXY`): a small separate service owns the
  content domain, fetches the content from your application and serves it, each
  item on its own origin. You set one variable and need no DNS record,
  certificate or proxy rule. See [Content proxy](#content-proxy).

If you set neither variable, nothing on this page applies and the application
behaves as it always has.

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

A [content proxy](#content-proxy) is the third option: any number of
installations use the same domain, and none of them needs a DNS record.

## Content proxy

A content proxy serves the content of any eXeLearning installation, on any
domain, from one shared content domain. The project runs one at
`exelearningusercontent.com`.

```env
EXE_CONTENT_PROXY=exelearningusercontent.com
```

That is the whole setup. Do not set `EXE_CONTENT_DOMAIN` as well: the server
refuses to start with both.

What the application needs:

- to be reachable from the internet over HTTPS, with a valid certificate, on a
  host name (the proxy does not fetch IP addresses);
- to know its public `https://` address, as described under
  [What you need](#what-you-need) (`TRUSTED_PROXIES` when TLS ends at a proxy).

An installation on an intranet or on `localhost` cannot use a public proxy,
because the proxy cannot reach it.

### How it works

Author content already has a safe address on the application host: the opaque
route `/view/<public view id>/_/…`, which answers with
`Content-Security-Policy: sandbox`. With a content proxy that route becomes a
**content source**. The viewer iframe points at

```text
https://x<40 hex>.exelearningusercontent.com/<base64url(source URL prefix)>/index.html
```

and the proxy answers it with the response of `<source URL prefix>index.html`.
The label is the SHA-256 hash of the source URL prefix, so:

- one published project, on one application address, is one origin;
- the proxy serves a response only when the label matches the prefix in the
  path, and the requested file is below that prefix. Content from one source can
  never appear on the origin of another, whoever asks;
- no secret, account or registration is shared with the proxy. The application
  derives the label the same way the proxy checks it.

The proxy only answers `GET`, sends no cookies or credentials to the
application, and passes no `Set-Cookie` on. It serves a response only when the
application marked it as a content source (`X-Exe-Content-Proxy: 1`), so it
cannot be used to show other sites under the content domain. The policy for the
content origin travels in `X-Exe-Content-Proxy-CSP`; the response keeps its own
opaque `Content-Security-Policy`, so the source URL stays harmless when it is
opened on the application host.

The editor preview works the same way. Its source is
`/preview-host/<project>/`, three static files that only exist with
`EXE_CONTENT_PROXY` set. The previewed project itself never passes through the
proxy: the editor hands it to the Service Worker of the content origin inside
the browser.

### What you accept by using a shared proxy

- **Published content passes through it.** Whoever runs the proxy can see, and
  could alter, the public content it serves and sees the address of every
  visitor. It cannot reach the application: it has no session and no credentials.
  Editor previews do not pass through it.
- **It is one more service that must be up.** If the proxy does not answer, the
  viewer and the preview show an error. They do not fall back to the application
  host.
- **Labels can be computed by anyone** who knows the source URL. They do not
  protect anything: access to a public view is the public view id, as before.
- **Every origin on the domain is the same site** as every other one, of every
  installation, until the domain is in the
  [Public Suffix List](https://publicsuffix.org/). Origin isolation (page,
  storage, Service Workers) does not depend on that.

An institution that does not want a third party in the path uses its own content
domain, or runs its own proxy.

### Run your own proxy

The proxy is `src/content-proxy/` in this repository: about 150 lines with no
dependencies, the same code for both options below. You need a domain on a
different site from the application, as with a content domain.

**Cloudflare Worker.** Add the domain to Cloudflare, create one proxied DNS
record for `*` that points nowhere (`AAAA * 100::`), edit the domain in
`src/content-proxy/wrangler.toml` and deploy:

```bash
bun x wrangler deploy --config src/content-proxy/wrangler.toml
```

The Worker answers every request for `*.<domain>`, so the record never reaches a
server. Turn off **Email Address Obfuscation** and **Rocket Loader** for the
zone, and turn on **Always Use HTTPS**: they apply to a Worker's responses too.
The free Workers plan allows 100,000 requests per day for the whole account, and
every file of a content item is one request.

**Any server.** Run it on Bun behind the wildcard DNS record, certificate and
reverse-proxy rule described above, pointing the rule at this process instead of
at eXeLearning:

```bash
CONTENT_PROXY_DOMAIN=content.example.org ALLOWED_HOSTS=exe.example.org PORT=8787 \
  bun src/content-proxy/index.ts
```

| Variable | Meaning |
|---|---|
| `CONTENT_PROXY_DOMAIN` | The domain the proxy answers under (`<label>.<domain>`). Required |
| `ALLOWED_HOSTS` | Comma-separated hosts the proxy may fetch from; `.example.org` matches subdomains. Empty: any public HTTPS host that opts in |
| `ALLOW_HTTP` | `true` also allows `http:` sources and local names. For development only |
| `PORT` | Port to listen on (Bun only; default 8787) |

Set `ALLOWED_HOSTS` on a proxy that runs inside your network: without it the
process fetches any address it is asked for. An open proxy also lets anyone who
runs a server show their own pages under your domain, each on an origin of its
own.

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

With a content proxy the label is `x` plus 40 characters, and two more checks
apply:

```bash
# The source is marked for the proxy, and is still opaque on the application host
curl -s -o /dev/null -D - 'https://online.exelearning.net/view/<public view id>/_/index.html' \
  | grep -iE '^(content-security-policy|x-exe-content-proxy)'

# The same content on the origin of another label answers 404
curl -s -o /dev/null -w '%{http_code}\n' \
  'https://x0000000000000000000000000000000000000000.exelearningusercontent.com/<rest of the content URL>'
```

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
| Content proxy: the content URL answers 502 "The address is not a content source" | The application does not have `EXE_CONTENT_PROXY` set, or runs a version without it | Set the variable and restart |
| Content proxy: the content URL answers 502 "The content source did not answer" | The proxy cannot reach the application | The application must be public, over HTTPS, with a valid certificate |
| Content proxy: the content URL answers 404 and its path decodes to an `http://` address | The application does not know it is served over HTTPS | Same as the first row |
| Content proxy: the content URL answers 403 | The proxy has a list of allowed hosts and the application is not in it | Ask whoever runs the proxy, or run your own |

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
- "Open in new tab" is not available in the preview panel.
- The print preview is not moved to the content domain.
- If the content domain cannot be reached, the preview shows an error. It does
  not fall back to the editor's origin.

## Limits

- With your own content domain, labels are derived from the server signing
  secret (`API_JWT_SECRET`). Rotating it changes every content origin; whatever
  content stored in the browser under the old origin is no longer reachable.
  All instances of a deployment must share `API_JWT_SECRET`, as they already do
  for sessions.
- With a content proxy, labels are derived from the address of the application.
  Changing its host name or `BASE_PATH` changes every content origin in the same
  way.
- Two content items are different origins but the same site unless the content
  domain is in the [Public Suffix List](https://publicsuffix.org/). Origin
  isolation (page, storage, Service Workers) does not depend on that.
- LMS and CMS plugins, the desktop app and the static build do not use the
  content domain.
