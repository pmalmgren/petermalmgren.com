---
title: Blogging From My iPad Pro
url: /ipad-pro-blog-setup/
draft: false
date: 2019-06-24
meta: false
categories: Software Development
tags: digitalocean, blink, hugo
description: Getting a blog up and running using an iPad Pro, DigitalOcean, and Hugo.
---

<div class="headline-image">
<img src="/apple-icon.jpg" style="width: 25%"/>
</div>
 
I love working on my iPad Pro. It's easy to carry around, relatively powerful, and doesn't suffer from the same [keyboard flaw] (https://www.forbes.com/sites/ewanspence/2019/03/27/apple-macbook-pro-butterfly-keyboard-serious-problem-confirmed/) as my Macbook Pro. I also really love running my own blog using [hugo](https://gohugo.io). Here is how I manage my Hugo blog from my iPad pro, complete with auto-reloading & CDN hosting.

## Editing Environment

<div class="headline-image">
<img src="/editing-environment.png" style="width: 100%; padding-top:40px;"/>
</div>

I run a live-editing environment on a [DigitalOcean development droplet](https://m.do.co/c/6c6de1f4746c) and use the Blink app to access it and upload files. I started by [provisioning a droplet](https://www.digitalocean.com/docs/droplets/how-to/create/), [installing Hugo](https://gohugo.io/getting-started/quick-start/) and running the following command to get a live-reloading URL with my blog:

```bash
$ hugo server -b http://{droplet-ip} --bind 0
```

Afterwards, I was able to head over to `http://{droplet-ip}:1313` and use an editor like Vim to write blog posts!

### Security

I didn't really want to risk exposing a hugo development server to the internet. To get around this reliably, I ended up setting up a VPN and add a firewall rule to your Hugo server. I provisioned another Droplet, setup an [Algo VPN](https://github.com/trailofbits/algo), transferred the VPN credentials back to my iPad using scp, and then ran the following command to only allow connections from the firewall:

```
$ sudo ufw default deny incoming
$ sudo ufw allow from {vpn-droplet-ip} to any port 1313
$ sudo ufw allow from {vpn-droplet-ip} to any port 60000:61000/udp # for mosh
$ sudo ufw enable
```

## Deployment

I use [Netlify](https://netlify.com) for hosting my blog. They have a free plan and also manage https certificates for you. I used this handy tutorial on [deploying Hugo](https://gohugo.io/hosting-and-deployment/hosting-on-netlify/). All deployments require is a [netlify.toml](https://github.com/pmalmgren/PM-Blog/blob/master/netlify.toml) file hosted in a GitHub repository and a push to master.

## Other Thoughts

### Using an iOS Writing App

Personally I really enjoy using iA Writer. At one point I had iA Writer syncing to Working Copy, which automatically streamed the changes to my DigitalOcean droplet. I might do another blog post on how I got this working in the future.

### Saving Money On DigitalOcean

One thing I didn't mention here is how labor intensive DigitalOcean droplets are, and how they charge you continously. There is a snapshot feature which charges $.05/GB of droplet space, which could save you a lot of money if you don't use your DigitalOcean account very often. I think a tool or an app might make this easier for developers. You could also store all of your files in a persistent volume, and then simply destroy and recreate your droplets.

### Uploading Media

You can upload things to DigitalOcean using `scp`, which comes with the Blink app. It can be a little bit tricky to get working with SSH keys though.


