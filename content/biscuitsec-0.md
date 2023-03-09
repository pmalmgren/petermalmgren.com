---
title: "Notes on Biscuits for Authentication"
date: 2023-03-08T07:53:41-05:00
draft: false
categories: Access and Identity Management
tags: security, authentication, oauth, jwt, macaroon
---

## What are biscuits?

[Biscuits](https://www.biscuitsec.org/) are a way to implement authorization tokens, such as [API tokens](https://fly.io/blog/api-tokens-a-tedious-survey/#biscuits), [OAuth access tokens](https://www.oauth.com/oauth2-servers/access-tokens/), and [session ID cookie values](https://docs.djangoproject.com/en/4.1/topics/http/sessions/#enabling-sessions).

## Important Concepts & Terminology

- **Authentication** is the process of verifying that someone is who they say they are
- **Authorization** is the process of verifying that a token has access to do some operation on a resource
- **Proof of possession** is a process to prove that someone is in possession of a private key
- **Delegation** is a way to give someone else access to act on your behalf in an authorization systems, either implicitly via a bearer token, or explicitly via attenuation
- **Attenuation** is the process of adding a restriction to a token to support delegation
- **Bearer tokens** are credentials which grant access to resources, delegating the authority associated with them to the holder of the token
- **Sessions** are some proof that a a user has authenticated, and are usually stored or identified by a cookie
- **Centralized or stateful authentication** is a system of authentication that relies in a bearer token and some database to verify that a token is valid
- **Decentralized or stateless authentication** is a system of authentication that relies on cryptography to verify that a token is valid

## Comparisons

### Biscuits vs JWTs

Biscuits are similar to [JWTs](https://jwt.io/introduction) in that they carry context about who is making the request and use public key cryptography for token verification. They both support **stateless authentication**.

Biscuits are different from JWTs by specifying that the [Ed25519 algorithm](https://www.biscuitsec.org/docs/reference/cryptography/) be used for cryptographic operations, which are verifying and creating tokens. 

In contrast to Biscuits, which mandate signing as part of the specification, JWTs can be unsigned or signed. If they are signed, the implementor is responsible for determining which encryption algorithm to use.

JWTs carry a JSON document, the keys of which are called claims, some of which are [specifically defined](https://www.iana.org/assignments/jwt/jwt.xhtml) while others can be defined by the implementor. JWTs are considered to be **bearer tokens** and the claims can support **authorization**.

And although JWTs shouldn't be used for [user sessions](https://redis.com/blog/json-web-tokens-jwt-are-dangerous-for-user-sessions/) and a lot of people [seem to](https://gist.github.com/samsch/0d1f3d3b4745d778f78b230cf6061452) [really](https://apibakery.com/blog/tech/no-jwt/) [hate them](https://betterprogramming.pub/stop-using-json-web-tokens-for-authentication-use-stateful-sessions-instead-c0a803931a5d), chances are you will have to deal with them at some point if you work with [OpenID Connect](https://openid.net/connect/) or products like [Supabase](https://supabase.com/).

### Biscuits vs Macaroons

Biscuits are really similar to [macaroons](https://research.google/pubs/pub41892/) in a number of ways:

1. They both support **stateless authentication**
2. They both provide **attenuation** to support **token delegation**
3. They both carry **authorization** policies, along with a way to verify those policies

The main difference between biscuits and macaroons is in the encryption algorithms they use. Macaroons use [MAC (message authentication code) encryption](https://en.wikipedia.org/wiki/Message_authentication_code) which requires a shared secret key to generate and verify that the tokens are valid. Biscuits use public key cryptography, which means that consumers of biscuits can verify their validity by sharing non-secret public keys with each other.

### Biscuits vs Centralized Token Service

By "a centralized token service" I mean some centralized database or service which:

1. Generates cryptographically random values and associates them with credentials
2. Can associate those credentials with permissions to support **authorization**
3. Can generate new credentials with a more limited subset of permissions from existing credentials to support **delegation** and **attenuation** 

The main difference between a biscuit and a centralized token service is that we need to talk to a database or a service to perform authentication and verify a user.

Biscuits can also be used as part of some centralized token service. Each biscuit has a unique [revocation ID](https://www.biscuitsec.org/docs/guides/revocation/) that can be used to stop it from being used in the case of a breach or a user logout.
