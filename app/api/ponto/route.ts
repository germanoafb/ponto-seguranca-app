import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // API para registrar ponto com selfie e localização GPS
    const body = await request.json();

    // TODO: Implementar lógica de registro
    return NextResponse.json({ success: true, data: body });
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao registrar ponto' }, { status: 500 });
  }
}
