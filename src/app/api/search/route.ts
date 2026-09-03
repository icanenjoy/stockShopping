import { NextResponse } from 'next/server'
import { getProvider } from '@/server/provider'

export async function GET(request: Request): Promise<Response> {
  const query = new URL(request.url).searchParams.get('q') ?? ''
  const stocks = await getProvider().search(query)
  return NextResponse.json({ stocks })
}
