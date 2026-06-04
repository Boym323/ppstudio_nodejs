import assert from "node:assert/strict";
import test from "node:test";

import { initialCancelVoucherActionState } from "@/features/admin/actions/cancel-voucher-action-state";
import { initialCreateManualBookingActionState } from "@/features/admin/actions/create-manual-booking-action-state";
import { initialCreateVoucherActionState } from "@/features/admin/actions/create-voucher-action-state";
import { initialRedeemBookingVoucherActionState } from "@/features/admin/actions/redeem-booking-voucher-action-state";
import { initialRescheduleBookingActionState } from "@/features/admin/actions/reschedule-booking-action-state";
import { initialSendVoucherEmailActionState } from "@/features/admin/actions/send-voucher-email-action-state";
import { initialAdminInviteActivationActionState } from "@/features/admin/actions/update-admin-invite-activation-action-state";
import { initialAdminUserAccessActionState } from "@/features/admin/actions/update-admin-user-access-action-state";
import { initialAdminUserResendInviteActionState } from "@/features/admin/actions/update-admin-user-resend-invite-action-state";
import { initialUpdateBookingNoteActionState } from "@/features/admin/actions/update-booking-note-action-state";
import { initialUpdateBookingPriceActionState } from "@/features/admin/actions/update-booking-price-action-state";
import { initialUpdateBookingServiceActionState } from "@/features/admin/actions/update-booking-service-action-state";
import { initialUpdateBookingSettingsActionState } from "@/features/admin/actions/update-booking-settings-action-state";
import { initialUpdateBookingStatusActionState } from "@/features/admin/actions/update-booking-status-action-state";
import { initialUpdateCalendarFeedActionState } from "@/features/admin/actions/update-calendar-feed-action-state";
import { initialUpdateClientNoteActionState } from "@/features/admin/actions/update-client-note-action-state";
import { initialUpdateEmailSettingsActionState } from "@/features/admin/actions/update-email-settings-action-state";
import {
  initialTestPushoverActionState,
  initialUpdatePushoverSettingsActionState,
} from "@/features/admin/actions/update-pushover-settings-action-state";
import { initialUpdateSalonSettingsActionState } from "@/features/admin/actions/update-salon-settings-action-state";
import { initialUpdateServiceActionState } from "@/features/admin/actions/update-service-action-state";
import { initialUpdateServiceCategoryActionState } from "@/features/admin/actions/update-service-category-action-state";
import { initialUpdateVoucherOperationalDetailsActionState } from "@/features/admin/actions/update-voucher-operational-details-action-state";

test("admin action-state modules expose idle initial states", () => {
  const states = [
    initialCancelVoucherActionState,
    initialCreateManualBookingActionState,
    initialCreateVoucherActionState,
    initialRedeemBookingVoucherActionState,
    initialRescheduleBookingActionState,
    initialSendVoucherEmailActionState,
    initialAdminInviteActivationActionState,
    initialAdminUserAccessActionState,
    initialAdminUserResendInviteActionState,
    initialUpdateBookingNoteActionState,
    initialUpdateBookingPriceActionState,
    initialUpdateBookingServiceActionState,
    initialUpdateBookingSettingsActionState,
    initialUpdateBookingStatusActionState,
    initialUpdateCalendarFeedActionState,
    initialUpdateClientNoteActionState,
    initialUpdateEmailSettingsActionState,
    initialUpdatePushoverSettingsActionState,
    initialTestPushoverActionState,
    initialUpdateSalonSettingsActionState,
    initialUpdateServiceActionState,
    initialUpdateServiceCategoryActionState,
    initialUpdateVoucherOperationalDetailsActionState,
  ];

  for (const state of states) {
    assert.deepEqual(state, { status: "idle" });
  }
});
