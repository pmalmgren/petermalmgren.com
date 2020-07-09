---
title: "PromQL and Prometheus Operator"
description: Prometheus Basis
date: 2020-07-08T09:38:38-04:00
draft: false
categories: Site Reliability Engineering
categories_weight: 1
---

A couple of weeks ago I started working on defining application SLOs so that teams could take ownership of their services.

As part of this work I had to dive head-first into metrics, querying, and alerting. This meant learning one of the most popular tools that SREs use for this, which is Prometheus, and the language used to query it, which is PromQL.

Here I'll share with you what I've learned along the way. Hopefully this helps you avoid some of the same mistakes and misunderstandings that I did!

If you have access to Prometheus, you can run all of these examples in the web UI.

## What is Prometheus?

<img src="/200px-Prometheus_software_logo.png" style="display: block; margin: auto"/>

[Prometheus](https://prometheus.io/docs/introduction/overview/) is a toolkit built for systems monitoring and alerting. It works by scraping metrics from running systems and storing them in a time-series database.

Metrics in Prometheus have two important characteristics: they have a name, one or more labels, and a type. There are [four types in Prometheus](https://prometheus.io/docs/concepts/metric_types/), and they are all numeric, representing a count or measurement of events. The types are:

1. Counter, an ever increasing metric representing a count of observations, analogous to the number of miles driven in a car
2. Gauge, a metric that can arbitrarily go up and down, analogous to the current speed of a car
3. Histogram and summary, two metrics that can be used to summarize observations into statistical buckets, the number of buckets you pick for a histogram metric will influence the cardinality of the metric

The collected metrics can be queried, and these queries can be put into [Grafana dashboards](https://grafana.com) and used for alerting.

Although you can run it by itself, Prometheus works really well with Kubernetes. One of the common ways to run Prometheus is with [Prometheus Operator](https://github.com/coreos/prometheus-operator) which takes care of scraping metrics, monitoring services and pods, setting up alerting, and loading Prometheus rules.

All of the examples in this blog post will use metrics that are exported by default from the Prometheus Operator. The three metrics that I'll be focusing on here are:

1. `nginx_ingress_controller_response_duration_seconds_count`
    - the total count of observations from Nginx ingress controllers that direct traffic to your services
2. `nginx_ingress_controller_response_duration_seconds_sum`
    - the total sum of observations (response duration in seconds) from Nginx ingress controllers
3. `nginx_ingress_controller_response_duration_seconds_bucket`
    - the set of buckets representing a histogram of response times from Nginx ingress controllers

### What is Prometheus good at?

As a rule, Prometheus data is *statistical*, which means it is sampled. You should not use PromQL or Prometheus for applications which require high degrees of precision or accuracy.

Prometheus is good at identifiying trends in data. If you're trying to answer questions like:

- What is the 99th percentile of response times of my API?
- What percent of requests are served with a 500 status code?

Then Prometheus is probably a good fit. You can answer these questions using PromQL.

### What is Prometheus bad at?

Prometheus is not good at metrics that can have a high degree of cardinality, or variation, in the metrics. HTTP responses can usually be grouped among a few different dimensions, such as HTTP response codes and response time buckets. The [Prometheus Operator](https://github.com/coreos/prometheus-operator) defines 12 latency buckets, and the HTTP standard defines around 70 HTTP response status codes.

Using these two numbers we can get the minimum cardinality of our Nginx metrics by multiplying them together, meaning our metric will have ~840 possible metric/label combinations (in reality it is smaller because we only see a fraction of those status codes in production). Even when adding in labels like environment or host, this number cannot increase in an unbounded fashion so it is a good fit for Prometheus.

Now let's assume that we want to add a label to our metrics for user IDs. Even with a small number of users (100) we have aleady increased our metric cardinality from 840 to 84,000. If our user base continues to grow, eventually Prometheus will run out of space and be unable to run queries. Metric labels which can grow in an unbounded fashion, like a user ID, are not a good fit for Prometheus.

### How does Prometheus collect data?

Prometheus collects data primarily through scraping HTTP metrics endpoints, but certain clients also support pushing data directly through Prometheus. 

Prometheus Operator is configured by default to scrape the /metrics endpoint of a service every 30 seconds, and ingest these metrics into its internal timeseries database.

A typical metrics endpoint will have text output that looks something like this:

```
metric_name{label="label"} 4932
metric_name{label="label2"} 90000
```

Once you have Prometheus up and running, you configure it to scrape a specified endpoint. Configuring Prometheus is outside the scope of this article, but if you're using [Prometheus Operator](https://github.com/coreos/prometheus-operator) you can configure your cluster Prometheus instance to scrape custom or service specific metrics with a [ServiceMonitor] (https://github.com/coreos/prometheus-operator/blob/master/Documentation/user-guides/getting-started.md).

## PromQL Metrics

All metrics in Prometheus are defined by a combination of a metric name, one or more labels with values, and a number or vector.

### Instant Vectors

If a metric is represented by a combination of a metric name, labels, and a single number then it is an instant vector.

Here is how you'd query for the instant vector which represents the total count of requests to all ingress controllers at the current point in time when you're running the query:

```yaml
nginx_ingress_controller_response_duration_seconds_count
```

Running this in the UI, you'd likely see a large list of elements. Each one corresponds to the metric, plus a combination of labels, with each metric/label combination having a value.

We can use labels to narrow down this list of elements. For example, to get the count of requests to an Nginx ingress pod that had a 301 status code in our production environment, we'd run a query like this:

```yaml
nginx_ingress_controller_response_duration_seconds_count{status="301", environment="production"}
```

The data type returned for these queries is a list of instant vectors, which correspond to a metric, a set of labels, and the latest known value for that metric label combination. They look something like this:

```yaml
nginx_ingress_controller_response_duration_seconds_count{status="301", environment="production", ip="10.0.0.1"} 23
nginx_ingress_controller_response_duration_seconds_count{status="301", environment="production", ip="10.0.0.2"} 100
```


### Range Vectors

To get a sense of how a metric changes over time, we can use range vectors. 

Range vectors queries are very similar to instant vector queries. The only difference is they have a range vector selector, corresponding to a slice of time, appended in square brackets at the end:

```yaml
# Get a range vector for the last five minutes for HTTP 500 responses in production
nginx_ingress_controller_response_duration_seconds_count{status="500", environment="production"}[5m]
```

The data returned from a range vector query is very similar to an instant vector, except for instead of a single number like we get with an instant vector, a range vector will have a list of observations and timestamps for each metric/label combination.

```yaml
nginx_ingress_controller_response_duration_seconds_count{status="301", environment="production", ip="10.0.0.1"}
5 @1593196346.226
5 @1593196376.226
6 @1593196406.226
6 @1593196436.226
6 @1593196466.226
7 @1593196496.226
7 @1593196526.226
8 @1593196556.226
80 @1593196586.226
80 @1593196616.226
nginx_ingress_controller_response_duration_seconds_count{status="301", environment="production", ip="10.0.0.2"}
5 @1593196346.226
5 @1593196376.226
5 @1593196406.226
5 @1593196436.226
5 @1593196466.226
5 @1593196496.226
5 @1593196526.226
5 @1593196556.226
5 @1593196586.226
5 @1593196616.226
```

You can predict how many observations you'll see based on the scrape interval and the range vector selector time. For example, if we're scraping every 30s and we specify a range vector selector of 5 minutes (300 seconds), then we can get the estimated number of data points in the range vector by dividing 300 seconds / 30 (scrapes/second), or ~10 scrapes.

#### Aside: Counters go to infinity, gauges go up and down

One interesting thing about Prometheus counters is that they always trend upwards towards infinity because they are, by definition, an ever-increasing number. This ever-increasing nature is invariant to system resets, i.e. when metrics go back down to 0 because the local state of the system loses the counter value. This explains why sometimes you will see a mismatch between the /metrics endpoint of a service and the values in instant and range vectors.

Gauge values, on the other hand, will always match the value of the scraped metric from the /metrics endpoint and can go up and down. A good example of a gauge metric is memory or CPU use.

### Histogram Metrics

Histogram metrics are ways of grouping metrics into buckets using a measurement, which typically a number. A common use for histogram metrics in the Prometheus Operator is for response latencies from Nginx ingress, which are grouped together into latency buckets which correspond to latency response time in seconds. The buckets are defined in the Prometheus client (used by Prometheus Operator) and are defined as: 

```go
DefBuckets = []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10}
```

Prometheus usually exposes histogram metrics with a special metric suffix called `_buckets` and a special metric label called `le` (short for less than or equal to). 

Histogram metrics are also typically exposed alongside two additional metrics which are suffixed with `_count` and `_total`, and correspond to the count of all observations and the sum of all observations.

All histogram metrics also have a special bucket called `+Inf` which corresponds to the number of requests that are less than positive infinity, which is basically the same as the total count of requests.

The Prometheus operator exposes latency metrics through the labels `nginx_ingress_controller_response_duration_seconds_bucket`, `nginx_ingress_controller_response_duration_seconds_total`, and `nginx_ingress_controller_response_duration_seconds_count`.

We can use histogram buckets to get the count of requests that took less than 50ms (.05s) with the following query:

```yaml
nginx_ingress_controller_response_duration_seconds_bucket{le=".05"}
```

## PromQL Operators and Functions

Operators and functions in Prometheus are basic expressions that use metrics and labels. They are the final piece of the puzzle that we'll need to answer questions like:

- What percentage of requests execute in under 1 second?
- What percentage of requests return a 500 error code?
- How many requests am I doing?
- What is the rate of application errors for the last 5 minutes?

### Using Operators

Next, I'm going to walk through how we can use operators on the metrics exposed by the Prometheus Operator to give us insight into the behavior of our systems. 

Below I will give an example of how to recreate some of the metrics you'd need to setup to create a multiwindow, multi-burn-rate alert as defined in the classic [SRE Workbook, Chapter 5](https://landing.google.com/sre/workbook/chapters/alerting-on-slos/).

### Calculating the Error Rate

The first requirement to implementing a multiwindow, multi-burn-rate SLO is to calculate the percentage of successful requests.

We'll start with this query, which is similar to the one we used above, to get a count of HTTP 5xx responses being served from our ingress. The `=~"5.*"` is a wildcard query which will match any label starting with 5.

```yaml
nginx_ingress_controller_response_duration_seconds_count{status=~"5.*", ingress="http-production"}
```

This returns a list of instant vectors, which is an integer value for the count of requests with a 500 response. An instant vector represents a snapshot in time, and in this case is the latest count of HTTP 500 responses. 

_Note: Depending on your setup, you will most likely get a list of numbers for different metric/label combinations. I'm assuming that you're serving traffic out of an ingress with the name `http-production` in these examples._

To get the total count of HTTP responses for the `http-production` across all labels, we can use the `sum` function:

```yaml
sum(nginx_ingress_controller_response_duration_seconds_count{status=~"5.*", ingress="http-production"})
```

Then to get the percentage of successful requests, we can use the division operator to get the total number of 5xx responses with the total number of responses and subtract by 1:

```yaml
1 - (
  sum(nginx_ingress_controller_response_duration_seconds_count{status=~"5.*", ingress="http-production"})
  /
  sum(nginx_ingress_controller_response_duration_seconds_count{ingress="http-production"})
)
```

### Calculating the Error Rate for a Given Time Window

The queries above give us the error rate for the last instant of time that we have a measurement for, but not for a given time window. Recall that we can query a time window using a range selector, i.e. `[5m]`, so let's try that here:


```yaml
1 - (
  sum(nginx_ingress_controller_response_duration_seconds_count{status=~"5.*", ingress="http-production"}[5m])
  /
  sum(nginx_ingress_controller_response_duration_seconds_count{ingress="http-production"}[5m])
)
```

If you run this query, you'll hit an error:

`Error executing query: 6:3: parse error: expected type instant vector in aggregation expression, got range vector`

This is because `sum` requires a list of instant vectors, and by adding the range query selector `[5m]` we are now returning a range vector, which is a list of timestamps and observations

To give `sum` something to make it happy, we need a way to transform the list of range vectors returned by the query into a list of instant vectors which can be summed. To do this, we'll use the [`rate`](https://prometheus.io/docs/prometheus/latest/querying/functions/#rate) function which takes a range vector as an argument and returns the per-second rate of increase over the range vector.

Mathematically this works out because we're dividing the per-second rate of increase of 5xx responses by the total per-second rate of increase of HTTP responses. Here's how it looks:

```yaml
1 - (
sum(rate(nginx_ingress_controller_response_duration_seconds_count{status=~"5.*", ingress="http-production"}[5m]))
/
sum(rate(nginx_ingress_controller_response_duration_seconds_count{ingress="http-production"}[5m]))
)
```

## An exercise

The next part, which I'll leave as an exercise to you, is to use Prometheus and the metrics exposed by the Prometheus Operator to calculate the following metrics:

- The percentage of requests served in under 1 second, which is how you'd define latency SLOs (hint: use the histogram buckets)
- The percentage of requests served without a 5xx error code AND in under 1 second, which is how you'd define a combined error/latency SLO

