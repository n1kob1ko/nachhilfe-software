import assert from "node:assert/strict";
import test from "node:test";
import { baseUrl } from "./base-url";

const lan = () => "192.168.1.20";
const none = () => null;

test("tablet address: PUBLIC_URL first, then the Railway domain", () => {
  assert.deepEqual(
    baseUrl({
      host: "localhost:3000",
      proto: null,
      env: {
        PUBLIC_URL: "https://lernheft.example.at/",
        RAILWAY_PUBLIC_DOMAIN: "x.up.railway.app",
      },
      lanAddress: lan,
    }),
    {
      url: "https://lernheft.example.at",
      localOnly: false,
    },
  );
  assert.equal(
    baseUrl({
      host: "10.0.0.5:8080",
      proto: "http",
      env: {
        RAILWAY_PUBLIC_DOMAIN: "nachhilfe-software-production.up.railway.app",
      },
      lanAddress: lan,
    }).url,
    "https://nachhilfe-software-production.up.railway.app",
  );
  assert.equal(
    baseUrl({
      host: "localhost:3000",
      proto: null,
      env: { PUBLIC_URL: "http://192.168.1.20:3000" },
      lanAddress: none,
    }).url,
    "http://192.168.1.20:3000",
  );
  // a broken value is ignored
  assert.equal(
    baseUrl({
      host: "schule.at",
      proto: "https",
      env: { PUBLIC_URL: "ftp://x", RAILWAY_PUBLIC_DOMAIN: " " },
      lanAddress: lan,
    }).url,
    "https://schule.at",
  );
});

test("tablet address: the host in use, localhost replaced by the address in the network", () => {
  assert.deepEqual(
    baseUrl({ host: "localhost:3000", proto: null, env: {}, lanAddress: lan }),
    { url: "http://192.168.1.20:3000", localOnly: false },
  );
  assert.equal(
    baseUrl({ host: "127.0.0.1:3000", proto: "http", env: {}, lanAddress: lan })
      .url,
    "http://192.168.1.20:3000",
  );
  assert.equal(
    baseUrl({
      host: "192.168.1.7:3000",
      proto: "http",
      env: {},
      lanAddress: lan,
    }).url,
    "http://192.168.1.7:3000",
  );
  assert.equal(
    baseUrl({
      host: "lernheft.example.at",
      proto: "https,http",
      env: {},
      lanAddress: lan,
    }).url,
    "https://lernheft.example.at",
  );
  assert.equal(
    baseUrl({
      host: "lernheft.example.at:443",
      proto: "https",
      env: {},
      lanAddress: lan,
    }).url,
    "https://lernheft.example.at",
  );
  // no network: still localhost, and the page says so
  assert.deepEqual(
    baseUrl({ host: "localhost:3000", proto: null, env: {}, lanAddress: none }),
    { url: "http://localhost:3000", localOnly: true },
  );
  // nothing odd from the header ends up in the link
  assert.equal(
    baseUrl({
      host: "evil.at/<script>",
      proto: "javascript",
      env: {},
      lanAddress: none,
    }).url,
    "http://localhost",
  );
});
