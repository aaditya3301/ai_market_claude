import { NextRequest, NextResponse } from 'next/server';
import { createPlanAndSeedCampaigns } from '@/lib/planning-service';
import { isFeatureEnabled } from '@/lib/runtime/features';
import { LEGACY_TENANT_ID } from '@/lib/tenancy/constants';

export const maxDuration = 300; // 5 minutes for AI generation

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tenantId = String(body.tenantId || req.headers.get('x-tenant-id') || LEGACY_TENANT_ID);
    const enabled = await isFeatureEnabled(tenantId, 'legacy_planning_api');
    if (!enabled) {
      return NextResponse.json({ error: 'Legacy planning endpoint disabled for this tenant' }, { status: 404 });
    }

    const { plan } = await createPlanAndSeedCampaigns({
      tenantId,
      brandId: body.brandId,
      productName: body.productName,
      description: body.description,
      websiteUrl: body.websiteUrl,
      instagramUrl: body.instagramUrl,
      linkedinUrl: body.linkedinUrl,
      twitterUrl: body.twitterUrl,
      imageBase64: body.imageBase64,
    });

    return NextResponse.json({ success: true, data: plan });

  } catch (error: any) {
    console.error('[Ghost Planner] Server Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
