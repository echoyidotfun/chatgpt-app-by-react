import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

/**
 * create or update chat & messages in db
 * @param request
 * @returns
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { id, ...data } = body;
  if (!data.chatId) {
    const chat = await prisma.chat.create({
      data: {
        title: "新对话",
      },
    });
    data.chatId = chat.id;
  } else {
    // 更新已有chat的updateTime
    await prisma.chat.update({
      data: {
        updateTime: new Date(),
      },
      where: {
        id: data.chatId,
      },
    });
  }

  const message = await prisma.message.upsert({
    create: data,
    update: data,
    where: {
      id,
    },
  });
  return NextResponse.json({ code: 0, data: { message } });
}
