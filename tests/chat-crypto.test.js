import test from "node:test";
import assert from "node:assert/strict";
import {CHAT_ROOM_TTL_MS,createChatRoom,decryptChatPacket,encryptChatPacket,formatChatHash,importChatKey,isChatRoomExpired,parseChatHash} from "../src/services/chatCrypto.js";

test("chat invitation round-trips and packet stays encrypted",async()=>{
  const now=1_800_000_000_000;
  const room=createChatRoom(now);
  assert.equal(room.expiresAt,now+CHAT_ROOM_TTL_MS);
  assert.deepEqual(parseChatHash(formatChatHash(room)),room);
  assert.equal(isChatRoomExpired(room,now+CHAT_ROOM_TTL_MS-1),false);
  assert.equal(isChatRoomExpired(room,now+CHAT_ROOM_TTL_MS),true);
  const key=await importChatKey(room.secret);
  const packet={type:"message",text:"Привіт 🙂"};
  const envelope=await encryptChatPacket(key,packet);
  assert.equal(envelope.ciphertext.includes(packet.text),false);
  assert.deepEqual(await decryptChatPacket(key,envelope),packet);
});

test("invalid invitations are rejected",()=>{
  assert.equal(parseChatHash("#chat-room-without-key"),null);
  assert.equal(parseChatHash("#chat-ATLAS-12345678-"+"A".repeat(64)),null);
});
