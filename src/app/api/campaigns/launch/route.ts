import { NextRequest, NextResponse } from 'next/server';
import { createAndGenerateCampaign } from '@/lib/campaign-service';
import { isFeatureEnabled } from '@/lib/runtime/features';
import { LEGACY_TENANT_ID } from '@/lib/tenancy/constants';

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { brandId, brandPlanId, campaignName, objective, platforms } = body;
    const tenantId = String(body.tenantId || req.headers.get('x-tenant-id') || LEGACY_TENANT_ID);
    const enabled = await isFeatureEnabled(tenantId, 'legacy_campaign_api');
    if (!enabled) {
      return NextResponse.json({ error: 'Legacy campaign endpoint disabled for this tenant' }, { status: 404 });
    }

    if (!brandPlanId || !campaignName || !objective || !platforms || platforms.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const activeBrandId = brandId || process.env.NEXT_PUBLIC_DEFAULT_BRAND_ID || 'brand_001';

    const result = await createAndGenerateCampaign({
      tenantId,
      brandId: activeBrandId,
      brandPlanId,
      campaignName,
      objective,
      platforms,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Campaign Launch Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
