import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SvgXml } from "react-native-svg";

const ACTIVE = "#85B8FF";
const IDLE = "#55555A";

const HOME = `<svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M13.75 19.2493V11.9159C13.75 11.6728 13.6534 11.4397 13.4815 11.2678C13.3096 11.0958 13.0764 10.9993 12.8333 10.9993H9.16667C8.92355 10.9993 8.69039 11.0958 8.51849 11.2678C8.34658 11.4397 8.25 11.6728 8.25 11.9159V19.2493M2.75 9.16637C2.74994 8.89968 2.80806 8.63619 2.92031 8.39428C3.03255 8.15237 3.19623 7.93785 3.39992 7.76571L9.81658 2.26571C10.1475 1.98604 10.5667 1.8326 11 1.8326C11.4333 1.8326 11.8525 1.98604 12.1834 2.26571L18.6001 7.76571C18.8038 7.93785 18.9674 8.15237 19.0797 8.39428C19.1919 8.63619 19.2501 8.89968 19.25 9.16637V17.4164C19.25 17.9026 19.0568 18.3689 18.713 18.7127C18.3692 19.0566 17.9029 19.2497 17.4167 19.2497H4.58333C4.0971 19.2497 3.63079 19.0566 3.28697 18.7127C2.94315 18.3689 2.75 17.9026 2.75 17.4164V9.16637Z" stroke="#55555A" stroke-width="2" stroke-linecap="round"/></svg>`;

const BOOKMARK = `<svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16.8804 3.28698C16.5365 2.94316 16.0701 2.75 15.5839 2.75H6.41614C5.92986 2.75 5.46349 2.94316 5.11963 3.28698C4.77578 3.6308 4.5826 4.09713 4.5826 4.58337V18.3336C4.58265 18.4941 4.62486 18.6518 4.70501 18.7909C4.78515 18.93 4.90042 19.0456 5.03928 19.1262C5.17815 19.2068 5.33573 19.2495 5.49627 19.25C5.65682 19.2505 5.81469 19.2089 5.95409 19.1293L10.0906 16.7661C10.3675 16.6079 10.681 16.5247 11 16.5247C11.319 16.5247 11.6325 16.6079 11.9094 16.7661L16.0459 19.1293C16.1853 19.2089 16.3432 19.2505 16.5037 19.25C16.6643 19.2495 16.8219 19.2068 16.9607 19.1262C17.0996 19.0456 17.2148 18.93 17.295 18.7909C17.3751 18.6518 17.4173 18.4941 17.4174 18.3336V4.58337C17.4174 4.09713 17.2242 3.6308 16.8804 3.28698Z" stroke="#55555A" stroke-width="2" stroke-linecap="round"/></svg>`;

const CALENDAR = `<svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7.333 2.75V5.5M14.667 2.75V5.5M3.667 9.167H18.333M4.583 4.583H17.417C18.337 4.583 19.083 5.329 19.083 6.25V18.333C19.083 19.254 18.337 20 17.417 20H4.583C3.662 20 2.917 19.254 2.917 18.333V6.25C2.917 5.329 3.662 4.583 4.583 4.583Z" stroke="#55555A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const BAG = `<svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14.6667 9.16652C14.6667 10.1391 14.2804 11.0718 13.5927 11.7595C12.9051 12.4471 11.9725 12.8335 11 12.8335C10.0275 12.8335 9.09491 12.4471 8.40728 11.7595C7.71964 11.0718 7.33333 10.1391 7.33333 9.16652M2.84399 5.53089H19.1552M3.11667 5.01094C2.87866 5.32831 2.75 5.71432 2.75 6.11103V18.3339C2.75 18.8202 2.94315 19.2865 3.28697 19.6304C3.63079 19.9742 4.0971 20.1674 4.58333 20.1674H17.4167C17.9029 20.1674 18.3692 19.9742 18.713 19.6304C19.0568 19.2865 19.25 18.8202 19.25 18.3339V6.11103C19.25 5.71432 19.1213 5.32831 18.8833 5.01094L17.05 2.56599C16.8792 2.33828 16.6578 2.15346 16.4032 2.02617C16.1487 1.89887 15.8679 1.8326 15.5833 1.8326H6.41667C6.13205 1.8326 5.85134 1.89887 5.59678 2.02617C5.34221 2.15346 5.12077 2.33828 4.95 2.56599L3.11667 5.01094Z" stroke="#55555A" stroke-width="2" stroke-linecap="round"/></svg>`;

const USER = `<svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M17.4174 19.25V17.4167C17.4174 16.4442 17.031 15.5116 16.3433 14.8239C15.6556 14.1363 14.7229 13.75 13.7503 13.75H8.24969C7.27711 13.75 6.34438 14.1363 5.65666 14.8239C4.96895 15.5116 4.5826 16.4442 4.5826 17.4167V19.25M14.6671 6.41667C14.6671 8.44171 13.0253 10.0833 11 10.0833C8.97472 10.0833 7.33291 8.44171 7.33291 6.41667C7.33291 4.39162 8.97472 2.75 11 2.75C13.0253 2.75 14.6671 4.39162 14.6671 6.41667Z" stroke="#55555A" stroke-width="2" stroke-linecap="round"/></svg>`;

export type BottomTab = "home" | "saved" | "week" | "shopping" | "help";

function NavIcon({ xml, active }: { xml: string; active: boolean }) {
  const colored = xml.replace(/stroke="#[^"]+"/g, `stroke="${active ? ACTIVE : IDLE}"`);
  return (
    <View style={styles.iconBox}>
      <SvgXml xml={colored} width={22} height={22} />
    </View>
  );
}

export default function BottomNav({
  active,
  onChange,
}: {
  active: BottomTab;
  onChange: (tab: BottomTab) => void;
}) {
  const insets = useSafeAreaInsets();
  const tabs: { id: BottomTab; label: string; xml: string }[] = [
    { id: "home", label: "Home", xml: HOME },
    { id: "saved", label: "Saved", xml: BOOKMARK },
    { id: "week", label: "Weekly", xml: CALENDAR },
    { id: "shopping", label: "Shopping", xml: BAG },
    { id: "help", label: "Help", xml: USER },
  ];

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.tabs}>
        {tabs.map((tab) => {
          const on = active === tab.id;
          return (
            <Pressable key={tab.id} style={styles.tab} onPress={() => onChange(tab.id)}>
              <NavIcon xml={tab.xml} active={on} />
              <Text
                style={[styles.label, on ? styles.labelOn : styles.labelOff]}
                numberOfLines={1}
                allowFontScaling={false}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: "#141416",
    borderTopWidth: 1,
    borderTopColor: "#28282C",
  },
  tabs: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 6,
    paddingTop: 12,
    paddingBottom: 8,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 2,
  },
  iconBox: { width: 22, height: 22, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  label: {
    fontSize: 10,
    lineHeight: 13,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600",
    textAlign: "center",
    includeFontPadding: false,
    paddingHorizontal: 1,
  },
  labelOn: { color: ACTIVE },
  labelOff: { color: IDLE, fontFamily: "Inter_400Regular", fontWeight: "500" },
});
