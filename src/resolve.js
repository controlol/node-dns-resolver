import { Resolver } from "node:dns/promises"
import { DnsError } from "./util.js"
import * as configuration from "./config.js"

/**
 * @typedef {import("./types.js").RecordType} DnsRecordType // not all types included
 *
 * @typedef {import("./types.js").DnsErrorInfo["chain"]} DnsChain
 * @typedef {Omit<import("./util.js").DnsErrorInfo, "error"|"chain">} DnsExpectedValue
 *
 * @typedef {object} DnsValid
 * @property {true} valid
 * @property {string} hostname example.com.
 * @property {DnsRecordType} recordType
 * @property {string} expectedValue
 */

// according to https://stackoverflow.com/a/25086755/12990079
const MAX_CNAME_DEPTH = 16

class DnsResolver {
  /** @type {Resolver} */
  #resolver
  /** @type {import("./config.js").DnsValidateConfig} */
  c

  /**
   * Creates a new instance of DnsResolver
   * @param {import("./config.js").DnsValidateConfig} [config] Override global configuration
   */
  constructor(config) {
    this.#resolver = new Resolver()
    if (config && typeof config === "object") this.c = config
    else this.c = configuration.get()
  }

  /**
   * Set the configuration of the resolver
   * @param {import("./config.js").DnsValidateConfig} [config] Override global configuration
   */
  config = (config) => {
    if (config && typeof config === "object") this.c = config
    else this.c = configuration.get()
  }

  static config = configuration.config
  static reset = configuration.reset
  static get = configuration.get

  /**
   *
   * @param {string} hostname
   * @returns {Promise<void>} Matched cname or ip addresses
   */
  validateWeb = (hostname) => {
    /** @type {DnsChain} */
    const chain = []
    return this.#validateCname(hostname, chain)
    .catch(error => {
      throw new DnsError("Validating IP address failed", 400, {
        hostname, error, chain,
        recordType: chain.at(-1)?.type || "CNAME",
        expectedValue: {
          CNAME: this.c.validCname[0], A: this.c.validIpv4[0], AAAA: this.c.validIpv6[0]
        }
      })
    })
  }

  /**
   * Verifies dns records for mail server
   * @param {string} hostname
   * @param {import("./types.js").DkimKeys|undefined} dkim
   * @returns {Promise<Record<"spf"|"mx"|"dkim", DnsValid|DnsError>>}
   */
  validateMail = async (hostname, dkim) => {
    /** @type {Record<"spf"|"mx"|"dkim", DnsValid|DnsError>} */
    // @ts-expect-error object is assigned later
    const results = {}

    await Promise.all([
      (async () => {
        await this.#validateSpf(hostname)
        .then(expectedValue => { results.spf = expectedValue})
        .catch(err => { results.spf = err })
      })(),
      (async () => {
        await this.#validateMx(hostname)
        .then(expectedValue => { results.mx = expectedValue})
        .catch(err => { results.mx = err })
      })(),
      (async () => {
        await this.#validateDkim(dkim)
        .then(expectedValue => { results.dkim = expectedValue})
        .catch(err => { results.dkim = err })
      })()
    ])

    return results
  }

  /**
   * Verifies if the hostname resolves to a whitelisted dkim record
   * @param {import("./types.js").DkimKeys|undefined} dkim
   * @returns {Promise<DnsValid>}
   */
  #validateDkim = async (dkim) => {
    if ((!dkim) || Object.keys(dkim || {}).length !== 2) throw new DnsError("No DKIM keys have been installed", 400, { recordType: "TXT", error: "unavailable", expectedValue: "", hostname: "", chain: [] })
    const { selector, publicKey: value } = dkim
    /** @type {DnsExpectedValue & { expectedValue: string }} */
    const expectedValue = {
      hostname: selector,
      recordType: "TXT",
      expectedValue: value
    }
    /** @type {DnsChain} */
    const chain = [{ nr: 0, type: "TXT", hostname: selector, result: "invalid" }]

    try {
      const records = await this.#resolver.resolveTxt(selector)
      if (records.length === 0) throw new DnsError(`No TXT records found for selector '${selector}'`, 404, {...expectedValue, error: "ENOTFOUND", chain})

      const i = records.findIndex(v => {
        const complete = v.join("")
        return complete === value
      })
      if (i === -1) throw new DnsError("Correct DKIM record was not found", 404, {...expectedValue, error: "ENOTFOUND", chain})

      return {...expectedValue, valid: true}
    } catch (err) {
      if (err instanceof DnsError) throw err
      if (err instanceof Error && "code" in err) {
        const status = err.code === "ENOTFOUND" ? 404 : 500
        throw new DnsError(`No TXT records found for selector '${selector}'`, status, {...expectedValue, error: err, chain})
      }
      throw err
    }
  }

  /**
   * Verifies if the hostname resolves to a whitelisted ip address
   * @param {string} hostname
   * @param {DnsChain} chain
   * @returns {Promise<string[]>} Matched ipv4 or ipv6 addresses
   */
  #validateIp = async (hostname, chain) => {
    // ipv6 is preferred by certbot
    return this.#validate6(hostname, chain)
    .catch(async err => {
      // a ipv6 address might exist that does not point to our server
      if (err?.code !== "ENODATA") throw err
      return this.#validate4(hostname, chain)
    })
  }

  /**
   * Verifies if the hostname resolves to a whitelisted ipv4 address
   * @param {string} hostname
   * @param {DnsChain} [chain]
   * @returns {Promise<string[]>} Matched ipv4 addresses
   */
  #validate4 = async (hostname, chain = []) => {
    const chainIndex = chain.length
    chain[chainIndex] = { nr: chainIndex, type: "A", hostname, result: "invalid" }

    const addresses = await this.#resolver.resolve4(hostname)
    .catch(err => {
      if (err.code !== "ENODATA") console.warn("validate4 error", err)
      chain[chainIndex].result = err.code
      throw err
    })

    const intersection = addresses.filter(e => this.c.validIpv4.includes(e))
    if (intersection.length) {
      chain[chainIndex].result = "valid"
      return intersection
    } else {
      chain[chainIndex].result = addresses
      throw new Error("No valid IPv4 addresses found")
    }
  }

  /**
   * Verifies if the hostname resolves to a whitelisted ipv6 address
   * @param {string} hostname
   * @param {DnsChain} [chain]
   * @returns {Promise<string[]>} Matched ipv6 addresses
   */
  #validate6 = async (hostname, chain = []) => {
    const chainIndex = chain.length
    chain[chainIndex] = { nr: chainIndex, type: "AAAA", hostname, result: "invalid" }

    const addresses = await this.#resolver.resolve6(hostname)
    .catch(err => {
      if (err.code !== "ENODATA") console.warn("validate6 error", err)
      chain[chainIndex].result = err.code
      throw err
    })

    const intersection = addresses.filter(e => this.c.validIpv6.includes(e))
    if (intersection.length) {
      chain[chainIndex].result = "valid"
      return intersection
    } else {
      chain[chainIndex].result = addresses
      throw new Error("No valid IPv6 addresses found")
    }
  }

  /**
   * verifies if the hostname resolves to a whitelisted cname or ip address
   * @param {string} hostname
   * @param {DnsChain} [chain]
   * @returns {Promise<void>}
   */
  #validateCname = async (hostname, chain = []) => {
    const chainIndex = chain.length
    chain[chainIndex] = { nr: chainIndex, type: "CNAME", hostname, result: "invalid" }

    try {
      const addresses = await this.#resolver.resolveCname(hostname)

      const intersection = addresses.filter(e => this.c.validCname.includes(e))
      if (intersection.length) {
        chain[chainIndex].result = "valid"
        return
      } else {
        chain[chainIndex].result = addresses
      }

      if (chain.length >= MAX_CNAME_DEPTH) throw new Error("CNAME record lookup exceeded maximum depth")

      // follow the first cname
      await this.#validateCname(addresses[0], chain)
    } catch (err) {
      if (err instanceof Error) throw err
      if (err instanceof Error && "code" in err) {
        chain[chainIndex].result = /** @type {import("./types.js").DnsErrorCodes} */ (err.code)

        // end of CNAME chain
        if (err.code === "ENODATA") {
          await this.#validateIp(hostname, chain)
          return
        }
      }

      throw err
    }
  }

  /**
   * Verifies if the hostname resolves to the expected SPF record
   * @param {string} hostname
   * @returns {Promise<DnsValid>}
   */
  #validateSpf = async (hostname) => {
    const { validSpf } = this.c

    /** @type {DnsExpectedValue & { expectedValue: string }} */
    const expectedValue = {
      hostname: `${hostname}.`,
      recordType: "TXT",
      expectedValue: `v=spf1 include:${validSpf} -all`
    }
    /** @type {DnsChain} */
    const chain = [{ nr: 0, type: "MX", hostname, result: "invalid" }]

    try {
      const records = await this.#resolver.resolveTxt(hostname)
      const spfRecords = records.filter(v => v[0].startsWith("v=spf1"))

      if (spfRecords.length === 0) throw new DnsError("No SPF record found", 404, {...expectedValue, error: "ENOTFOUND", chain})
      if (spfRecords.length > 1) throw new DnsError("Cannot have more than 1 SPF record", 409, {...expectedValue, error: "PERMERROR", chain})

      const spf = spfRecords[0].join("")
      if (!spf.includes(`include:${validSpf}`)) {
        chain[0].result = [ spf ]
        throw new DnsError(`'${validSpf}' is not included in spf record: '${spf}'`, 404, {...expectedValue, error: "invalid", chain})
      }

      return {...expectedValue, valid: true}
    } catch (err) {
      if (err instanceof DnsError) throw err
      if (err instanceof Error && "code" in err) {
        const status = err.code === "ENOTFOUND" ? 404 : 500
        throw new DnsError("No SPF record found", status, {...expectedValue, error: err.code, chain})
      }
      throw err
    }
  }

  /**
   * Verifies if the hostname resolves to the expected MX record
   * @param {string} hostname
   * @returns {Promise<DnsValid>}
   */
  #validateMx = async hostname => {
    const { validMx } = this.c

    /** @type {DnsExpectedValue & { expectedValue: string }} */
    const expectedValue = {
      hostname: `${hostname}.`,
      recordType: "MX",
      expectedValue: `0 ${validMx[0]}.`,
    }
    /** @type {DnsChain} */
    const chain = [{ nr: 0, type: "MX", hostname, result: "invalid" }]

    try {
      const addresses = await this.#resolver.resolveMx(hostname)

      const [ priorityDomain ] = addresses.sort((a, b) => a.priority - b.priority)
      if (!validMx.includes(priorityDomain.exchange)) {
        chain[0].result = addresses.map(e => `${e.priority} ${e.exchange}`)
        throw new DnsError(`Please set '${validMx[0]}' as the MX with the highest priority.`, 409, {...expectedValue, error: "invalid", chain})
      }

      return {...expectedValue, valid: true}
    } catch (err) {
      if (err instanceof DnsError) throw err
      if (err instanceof Error && "code" in err) {
        const status = err.code === "ENOTFOUND" ? 404 : 500
        throw new DnsError("No MX record found", status, {...expectedValue, error: err, chain})
      }
      throw err
    }
  }
}

export default DnsResolver
