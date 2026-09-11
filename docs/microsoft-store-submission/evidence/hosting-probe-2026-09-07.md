# Installer-hosting probe — 2026-09-07

Target: `https://getritemark.com/probe/hosting-test-v1.txt`

This is a safe 29-byte text object, not an installer and not a Partner Center package URL.

## Configuration observed

- R2 bucket: `ritemark-downloads-prod`
- Custom domain: `getritemark.com`
- Public access through custom domain: enabled
- Minimum TLS: 1.2
- R2 development URL: disabled
- Managed DNS record: proxied apex CNAME owned by the R2 integration

## Public DNS

Cloudflare's public DNS-over-HTTPS resolver returned status `0` with these answers:

- A: `104.21.38.77`, `172.67.220.22`
- AAAA: `2606:4700:3036::ac43:dc16`, `2606:4700:3035::6815:264d`
- TTL observed: 300 seconds

## TLS

- Negotiated protocol: TLS 1.3
- Certificate issuer: Google Trust Services `WE1`
- Subject alternative name matched `getritemark.com`
- Certificate verification: passed
- HTTP protocol: HTTP/2

## HTTP and object response

Fresh `curl` request with no cookie jar, authentication, or prior session:

```text
status=200
redirects=0
content_type=text/plain
size_download=29
ssl_verify=0
```

Response headers included:

```text
HTTP/2 200
content-type: text/plain
content-length: 29
accept-ranges: bytes
server: cloudflare
```

No `Location` or `Set-Cookie` header was present. The response was the object itself, not HTML, a login page, or a confirmation screen.

## SHA-256

```text
Source:     0876e27223178460fffa1cbff079af7d07592929f0e5693490f2c18a4f1be57e
Downloaded: 0876e27223178460fffa1cbff079af7d07592929f0e5693490f2c18a4f1be57e
```

Both files were 29 bytes. The end-to-end probe therefore passed.

## Cleanup

After the checks passed, Jarmo explicitly approved removal of all temporary probe data. The complete `probe/` prefix was permanently deleted from `ritemark-downloads-prod` on 2026-09-07. This removed both `probe/hosting-test-v1.txt` and the unintended duplicate `probe/ritemark-hosting-probe-v1.txt`, together with the folder marker.

Cloudflare reported `1 folder was successfully deleted`, the bucket returned to `0 B`, and fresh anonymous requests to both former URLs returned HTTP `404`. No probe objects remain in the bucket.

Production readiness remains open until a no-overwrite upload command and the `windows/` immutability control are configured and tested, and the exact v1.10.0 installer is downloaded from its final URL with the approved SHA-256.
