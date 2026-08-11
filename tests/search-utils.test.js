import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMarketplaceShortcuts,extractListingQuantityTonnes,extractRequestedKilograms,extractRequestedTonnes,
  inferSourceType,isActionableCommerceResult,isProductTransaction,marketplaceSearchTerm,rankMarketplaceResults,sourceGroupsFor
} from "../api/_search-utils.js";

test("extracts requested bulk quantity in tonnes",()=>{
  assert.equal(extractRequestedTonnes("Потрібно купити 20 тонн картоплі"),20);
  assert.equal(extractRequestedTonnes("Треба 20 т картоплі"),20);
  assert.equal(extractRequestedTonnes("Куплю 20000 кг картоплі"),20);
});

test("preserves a 100 kg request instead of losing it below one tonne",()=>{
  assert.equal(extractRequestedKilograms("Потрібно 100 кг гороху"),100);
  assert.equal(extractRequestedTonnes("Потрібно 100 кг гороху"),0.1);
  assert.equal(extractListingQuantityTonnes("Продам горох від 100 кг"),0.1);
});

test("extracts declared listing capacity",()=>{
  assert.equal(extractListingQuantityTonnes("Продам картоплю, в наявності 100 тонн"),100);
  assert.equal(extractListingQuantityTonnes("Партія 50000 кг"),50);
});

test("recognizes Ukrainian agriculture boards as marketplaces",()=>{
  for(const url of ["https://agro-ukraine.com/ua/trade/","https://flagma.ua/products/kartofel/","https://agrotorg.net/ua/board/"]){
    assert.equal(inferSourceType(url),"marketplace");
  }
});

test("uses agriculture, OLX and business-classified source groups",()=>{
  const groups=sourceGroupsFor({source:"marketplace",goal:"Купити 20 тонн картоплі",domain:"сільське господарство"});
  assert.deepEqual(groups.map(group=>group.id),["agriculture","olx","business-classifieds"]);
  assert.ok(groups.flatMap(group=>group.domains).includes("agro-ukraine.com"));
  assert.ok(groups.flatMap(group=>group.domains).includes("olx.ua"));
  assert.ok(groups.flatMap(group=>group.domains).includes("flagma.ua"));
});

test("uses stores, Rozetka and OLX for a 100 kg pea request",()=>{
  const groups=sourceGroupsFor({source:"marketplace",goal:"Потрібно купити 100 кг гороху",domain:"продукти"});
  assert.deepEqual(groups.map(group=>group.id),["retail-stores","olx","agriculture"]);
  assert.ok(groups.flatMap(group=>group.domains).includes("rozetka.com.ua"));
  assert.ok(groups.flatMap(group=>group.domains).includes("silpo.ua"));
  assert.ok(groups.flatMap(group=>group.domains).includes("olx.ua"));
});

test("puts ATB with product and Google Maps navigation before marketplace alternatives",()=>{
  assert.equal(marketplaceSearchTerm("Потрібно купити 100 кг гороху"),"горох");
  assert.equal(marketplaceSearchTerm("горох україна горох продаж OLX Agroboard Prom.ua"),"горох");
  const shortcuts=buildMarketplaceShortcuts({query:"Потрібно купити 100 кг гороху",locationText:"Тернопіль"});
  assert.deepEqual(shortcuts.map(item=>item.source_name),["АТБ","OLX","Rozetka","Prom.ua","Google Maps"]);
  const atb=shortcuts.find(item=>item.source_name==="АТБ");
  assert.equal(atb.result_kind,"store_option");
  assert.match(atb.url,/atbmarket\.com\/catalog\/395-krupi/);
  assert.match(atb.google_maps_url,/google\.com\/maps\/dir/);
  assert.match(decodeURIComponent(atb.google_maps_url),/АТБ Тернопіль/);
  assert.match(shortcuts.find(item=>item.source_name==="Rozetka").url,/rozetka\.com\.ua\/ua\/search/);
  assert.match(shortcuts.find(item=>item.source_name==="Google Maps").url,/google\.com\/maps\/search/);
  assert.match(decodeURIComponent(shortcuts.find(item=>item.source_name==="Google Maps").url),/горох магазин Тернопіль/);
});

test("treats a bare quantity and product as a commerce request",()=>{
  assert.equal(isProductTransaction("100 кг гороху"),true);
});

test("rejects generic prose pages as commerce solutions",()=>{
  assert.equal(isActionableCommerceResult({url:"https://graintrade.com.ua/novyny/goroh",source_group:"open-web"}),false);
  assert.equal(isActionableCommerceResult({url:"https://agrarka.com/post/goroh",source_group:"open-web"}),false);
  assert.equal(isActionableCommerceResult({url:"https://silpo.ua/product/gorokh-kolotyi-529700",source_group:"retail-stores"}),true);
  assert.equal(isActionableCommerceResult({url:"https://www.olx.ua/uk/list/q-goroh/",source_group:"olx"}),true);
});

test("ranks a concrete listing that covers the request above category and small offers",()=>{
  const results=rankMarketplaceResults([
    {title:"Картопля гуртом",snippet:"Каталог пропозицій",url:"https://olx.ua/uk/list/q-kartoplya/",source_type:"marketplace",source_group:"olx",quantity_tonnes:null},
    {title:"Продам 2,5 тонни картоплі",snippet:"Ціна договірна",url:"https://example.com/offer/small",source_type:"marketplace",source_group:"agriculture",quantity_tonnes:2.5},
    {title:"Продам картоплю — 100 тонн",snippet:"Опт, є доставка",url:"https://agro-ukraine.com/ua/trade/m-123",source_type:"marketplace",source_group:"agriculture",quantity_tonnes:100}
  ],{requestedTonnes:20});
  assert.match(results[0].title,/100 тонн/);
});
