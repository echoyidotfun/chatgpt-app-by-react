import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

/**
 * delete message record by id from db
 * @param request
 * @returns
 */
export async function POST(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ code: -1 });
  }
  await prisma.message.delete({
    where: {
      id,
    },
  });
  return NextResponse.json({ code: 0 });
}
