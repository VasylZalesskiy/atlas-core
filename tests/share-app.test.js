import test from "node:test";
import assert from "node:assert/strict";
import {ATLAS_SHARE_URL,atlasShareText,createMessengerLinks} from "../src/services/shareApp.js";

test("Atlas share link always points to the stable production app",()=>{
  assert.equal(ATLAS_SHARE_URL,"https://atlas-core-two.vercel.app/");
});

test("messenger links contain the Atlas URL and readable invite text",()=>{
  const links=createMessengerLinks("uk");
  assert.ok(links.telegram.startsWith("https://t.me/share/url?"));
  assert.ok(links.whatsapp.startsWith("https://wa.me/?text="));
  assert.ok(links.viber.startsWith("viber://forward?text="));
  assert.ok(decodeURIComponent(links.telegram).includes(ATLAS_SHARE_URL));
  assert.ok(decodeURIComponent(links.whatsapp).includes(atlasShareText("uk")));
});
