/**
 * @typedef {object} DnsValidateConfig
 * @property {string[]} validIpv4 IPv4 addresses to resolve as valid
 * @property {string[]} validIpv6 IPv6 addresses to resolve as valid
 * @property {string[]} validCname CNAME values to resolve as valid
 * @property {string} validSpf SPF value to resolve as valid
 * @property {string[]} validMx MX ip address to resolve as valid
 */

/** @type {DnsValidateConfig} */
const configuration = {
  validIpv4: [],
  validIpv6: [],
  validCname: [],
  validSpf: "",
  validMx: []
}

/**
 * @param {Partial<DnsValidateConfig>} config
 * @param {boolean} [append=true]
 * @returns {DnsValidateConfig}
 */
export const config = (config, append = true) => {
  if (append) {
    if (Array.isArray(config.validIpv4)) configuration.validIpv4.push(...config.validIpv4)
    if (Array.isArray(config.validIpv6)) configuration.validIpv6.push(...config.validIpv6)
    if (Array.isArray(config.validCname)) configuration.validCname.push(...config.validCname)
    if (typeof config.validSpf === "string") configuration.validSpf = config.validSpf
    if (Array.isArray(config.validMx)) configuration.validMx.push(...config.validMx)
  } else {
    if (Array.isArray(config.validIpv4)) configuration.validIpv4 = config.validIpv4
    if (Array.isArray(config.validIpv6)) configuration.validIpv6 = config.validIpv6
    if (Array.isArray(config.validCname)) configuration.validCname = config.validCname
    if (typeof config.validSpf === "string") configuration.validSpf = config.validSpf
    if (Array.isArray(config.validMx)) configuration.validMx = config.validMx
  }

  return get()
}

/**
 * Restore configuration to empty values
 * All resolve queries will fail
 * @returns {DnsValidateConfig}
 */
export const reset = () => {
  configuration.validIpv4 = []
  configuration.validIpv6 = []
  configuration.validCname = []
  configuration.validSpf = ""
  configuration.validMx = []
  return get()
}

export const get = () => {
  // never return the config by reference
  return structuredClone(configuration)
}
