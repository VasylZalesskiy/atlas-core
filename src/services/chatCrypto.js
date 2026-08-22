export function randomHex(bytes=16){
  const value=crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(value,byte=>byte.toString(16).padStart(2,"0")).join("");
}

export const CHAT_ROOM_TTL_MS=60*60*1000;

export function createChatRoom(now=Date.now()){
  return {
    roomId:`ATLAS-${randomHex(4).toUpperCase()}`,
    secret:randomHex(32).toUpperCase(),
    expiresAt:now+CHAT_ROOM_TTL_MS
  };
}

export function formatChatHash(room){
  return `#chat-${room.roomId}-${room.secret}-${room.expiresAt}`;
}

export function parseChatHash(hash){
  const match=String(hash||"").match(/^#chat-(ATLAS-[A-F0-9]{8})-([A-F0-9]{64})-(\d{13})$/i);
  if(!match)return null;
  const expiresAt=Number(match[3]);
  return Number.isSafeInteger(expiresAt)
    ?{roomId:match[1].toUpperCase(),secret:match[2].toUpperCase(),expiresAt}
    :null;
}

export function isChatRoomExpired(room,now=Date.now()){
  return !room||room.expiresAt<=now;
}

function bytesToBase64Url(value){
  let binary="";
  value.forEach(byte=>{binary+=String.fromCharCode(byte)});
  return btoa(binary).replaceAll("+","-").replaceAll("/","_").replaceAll("=","");
}

function base64UrlToBytes(value){
  const normalized=String(value).replaceAll("-","+").replaceAll("_","/");
  const binary=atob(normalized+"=".repeat((4-(normalized.length%4))%4));
  return Uint8Array.from(binary,character=>character.charCodeAt(0));
}

function hexToBytes(value){
  return Uint8Array.from(String(value).match(/.{1,2}/g)||[],pair=>Number.parseInt(pair,16));
}

export function importChatKey(secret){
  return crypto.subtle.importKey("raw",hexToBytes(secret),{name:"AES-GCM"},false,["encrypt","decrypt"]);
}

export async function encryptChatPacket(key,packet){
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const plaintext=new TextEncoder().encode(JSON.stringify(packet));
  const ciphertext=await crypto.subtle.encrypt({name:"AES-GCM",iv},key,plaintext);
  return {iv:bytesToBase64Url(iv),ciphertext:bytesToBase64Url(new Uint8Array(ciphertext))};
}

export async function decryptChatPacket(key,envelope){
  const plaintext=await crypto.subtle.decrypt(
    {name:"AES-GCM",iv:base64UrlToBytes(envelope.iv)},
    key,
    base64UrlToBytes(envelope.ciphertext)
  );
  return JSON.parse(new TextDecoder().decode(plaintext));
}
