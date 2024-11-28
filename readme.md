# Node DNS Resolver

An implementation build on top of the [node-dns](https://nodejs.org/api/dns.html) module to validate dns records.

## Installation

1. Add the repository as a submodule to your git repository.
2. In the root of your npm project, run `npm install <path-to-submodule>`

## Setup

To use the DNS validation you can import the class and configure the valid values records.

```js
import Resolver from "dns-resolver"

const configuration = {
  validIpv4: ["127.0.0.1"],
  validIpv6: ["::1"],
  validCname: [],
  validSpf: "",
  validMx: []
}

const resolver = new Resolver(configuration)

resolver.validateWeb("example.com")
.then(result => {
  console.log("example.com resolved to a valid ip address")
})
.catch(err => {
  console.warn("example.com could not be resolved")
  console.warn(err)
})
```

For CNAME or Web validation the resolver will follow the CNAME records until it reaches a valid record. If the maximum depth is reached, the validation will fail. When the validation fails the error will contain the chain of records that were queried.

### Global configuration

It's also possible to configure the resolver globally. To use the global configuration in a resolver instance omit the `config` argument in the constructor. The global configuration of the instance is not automatically updated when the configuration is changed. It's possible to update the configuration by calling the `config` method on the instance.

```js
import Resolver from "dns-resolver"

Resolver.config({
  validIpv4: ["127.0.0.1"],
  validIpv6: ["::1"],
  validCname: [],
  validSpf: "",
  validMx: []
})
```
