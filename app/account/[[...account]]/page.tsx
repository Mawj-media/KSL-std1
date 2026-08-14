import {
  UserProfileProvider,
  UserProfileAccountPanel,
  UserProfileProfileSection,
  UserProfileConnectedAccountsSection,
  UserProfileSecurityPanel,
  UserProfilePasswordSection,
  UserProfilePasskeysSection,
  UserProfileMfaSection,
  UserProfileActiveDevicesSection,
} from "@clerk/ui/experimental";

export const dynamic = "force-dynamic";

export default function AccountPage() {
  return (
    <div className="content" style={{ maxWidth: 720, margin: "0 auto" }}>
      <div className="topbar-title">Account</div>
      <div className="topbar-sub">Manage your profile and security settings.</div>
      <div style={{ marginTop: 24, display: "grid", gap: 24 }}>
        <UserProfileProvider>
          <UserProfileAccountPanel>
            <UserProfileProfileSection />
            <UserProfileConnectedAccountsSection />
          </UserProfileAccountPanel>
          <UserProfileSecurityPanel>
            <UserProfilePasswordSection />
            <UserProfilePasskeysSection />
            <UserProfileMfaSection />
            <UserProfileActiveDevicesSection />
          </UserProfileSecurityPanel>
        </UserProfileProvider>
      </div>
    </div>
  );
}