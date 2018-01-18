import { pki, md } from 'node-forge'
import { readFileSync } from 'fs'

if (process.env.SERVICE === 'gen-ssl') {
  IPC.answer('gen-ssl', (domain) => {
    return generateCert(domain)
  })
}

let rootPair = null
function getRootPair () {
  if (!rootPair) {
    if (!Store.tmp.rootCA) {
      return new Promise(r => setTimeout(r, 100)).then(getRootPair)
    }
    const rootCA = pki.certificateFromPem(Store.tmp.rootCA.cer)
    const rootKey = pki.privateKeyFromPem(Store.tmp.rootCA.key)
    rootPair = { rootCA, rootKey }
  }
  return Promise.resolve(rootPair)
}

let serialCounter = 0;
function createSerialNumber() {
  serialCounter++;
  const ret = `${serialCounter}`
  if (ret.length & 1) {
    return `0${ret}`
  }
  return ret
}

function generateCert (domain) {
  return getRootPair()
  .then(({ rootCA, rootKey }) => {
    const keys = pki.rsa.generateKeyPair(1024)
    const cert = pki.createCertificate()
    cert.publicKey = keys.publicKey
    cert.serialNumber = createSerialNumber()
    const curYear = new Date().getFullYear()
    cert.validity.notBefore = new Date()
    cert.validity.notBefore.setFullYear(curYear - 1)
    cert.validity.notAfter = new Date()
    cert.validity.notAfter.setFullYear(curYear + 1)
    const attrs = [
      {
        name: 'commonName',
        value: domain,
      },
      {
        name: 'countryName',
        value: 'CN',
      },
      {
        shortName: 'ST',
        value: 'Beijing',
      },
      {
        name: 'localityName',
        value: 'Beijing',
      },
      {
        name: 'organizationName',
        value: 'Zokor',
      },
      {
        shortName: 'OU',
        value: 'ZokorProxy',
      }
    ]
    cert.setSubject(attrs)
    cert.setIssuer(rootCA.subject.attributes)
    cert.setExtensions([
      {
        name: 'basicConstraints',
        cA: true
      },
      {
        name: 'keyUsage',
        keyCertSign: true,
        digitalSignature: true,
        nonRepudiation: true,
        keyEncipherment: true,
        dataEncipherment: true
      },
      {
        name: 'extKeyUsage',
        serverAuth: true,
        clientAuth: true,
        codeSigning: true,
        emailProtection: true,
        timeStamping: true
      },
      {
        name: 'nsCertType',
        client: true,
        server: true,
        email: true,
        objsign: true,
        sslCA: true,
        emailCA: true,
        objCA: true
      },
      {
        name: 'subjectAltName',
        altNames: [
          {
            type: 2,
            value: domain
          }
        ]
      },
      {
        name: 'subjectKeyIdentifier'
      }
    ])
    cert.sign(rootKey, md.sha256.create())
    const keyString = pki.privateKeyToPem(keys.privateKey)
    const certString = pki.certificateToPem(cert)
    console.log(domain, certString)
    return {
      key: keyString,
      cert: certString,
    }
  })
}

export function ensureRootCA () {
  const caFile = 'ca.json'
  try {
    const { cer, key, time } = JSON.parse(readFileSync(userDir(caFile)).toString())
    if (cer && key) {
      Store.tmp.rootCA = { cer, key }
      return
    }
  } catch (err) {
    console.error(err.stack)
  }
  const keys = pki.rsa.generateKeyPair(1024)
  const cert = pki.createCertificate()
  cert.publicKey = keys.publicKey
  cert.serialNumber = createSerialNumber()
  const curYear = new Date().getFullYear()
  cert.validity.notBefore = new Date()
  cert.validity.notBefore.setFullYear(curYear - 1)
  cert.validity.notAfter = new Date()
  cert.validity.notAfter.setFullYear(curYear + 10)
  const attrs = [
    {
      name: 'commonName',
      value: Date.now() + '.zokor',
    },
    {
      name: 'countryName',
      value: 'CN',
    },
    {
      shortName: 'ST',
      value: 'Beijing',
    },
    {
      name: 'localityName',
      value: 'Beijing',
    },
    {
      name: 'organizationName',
      value: 'Zokor',
    },
    {
      shortName: 'OU',
      value: 'ZokorProxy',
    }
  ]
  cert.setSubject(attrs)
  cert.setIssuer(attrs)
  cert.sign(keys.privateKey, md.sha256.create())
  const keyString = pki.privateKeyToPem(keys.privateKey)
  const certString = pki.certificateToPem(cert)
  Store.tmp.rootCA = {
    key: keyString,
    cer: certString,
    time: Date.now()
  }
  writeUserData(caFile, JSON.stringify(Store.tmp.rootCA))
}

