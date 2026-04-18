import { NextResponse } from 'next/server';
import { optimizeProfile } from '@/lib/profile-service';

export async function POST(req: Request) {
  try {
    const { brandId, platform, brandContext } = await req.json();

    if (!brandId || !platform || !brandContext) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const setup = await optimizeProfile(brandId, platform, brandContext);
    
    return NextResponse.json({ setup });
  } catch (error: any) {
    console.error('Profile Optimization Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
