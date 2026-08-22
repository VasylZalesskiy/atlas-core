import test from "node:test";
import assert from "node:assert/strict";
import {decodeOpportunityText,encodeOpportunityText} from "../src/services/opportunityCodec.js";

test("opportunity text remains unchanged while Passport metadata round-trips",()=>{
  const entry={
    group:"have",
    text:"маю 20 кг зайвої картоплі",
    duration:"day",
    place:"Львів",
    radiusValue:"30",
    radiusUnit:"км",
    online:false,
    paymentType:"paid",
    priceValue:"18.5",
    priceUnit:"кг",
    currency:"UAH",
    minimumQuantity:"20",
    deliveryIncluded:true
  };
  const stored=encodeOpportunityText(entry);
  const decoded=decodeOpportunityText(stored,"share");
  assert.deepEqual(decoded,entry);
  assert.ok(stored.length<=1495);
});

test("legacy opportunities remain readable",()=>{
  assert.deepEqual(decodeOpportunityText("Можу полагодити генератор","help"),{
    text:"Можу полагодити генератор",
    group:"help",
    duration:"month",
    place:"",
    radiusValue:"",
    radiusUnit:"км",
    online:false,
    paymentType:"free",
    priceValue:"",
    priceUnit:"шт.",
    currency:"UAH",
    minimumQuantity:"",
    deliveryIncluded:false
  });
});
