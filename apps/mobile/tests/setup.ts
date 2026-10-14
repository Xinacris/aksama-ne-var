import mockAsyncStorage from "@react-native-async-storage/async-storage/jest/async-storage-mock";

jest.mock("@react-native-async-storage/async-storage", () => mockAsyncStorage);

// expo-crypto's native random source → Node's in tests.
jest.mock("expo-crypto", () => ({
  getRandomBytes: (n: number) => new Uint8Array(require("node:crypto").randomBytes(n)),
}));

jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
}));

jest.mock("expo-localization", () => ({ getLocales: () => [{ languageTag: "tr-TR", languageCode: "tr" }] }));

// expo-router: navigation calls are recorded; screens render without a navigator.
jest.mock("expo-router", () => {
  const React = require("react");
  const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
  const params: { current: Record<string, string> } = { current: {} };
  const Stack = Object.assign(({ children }: { children?: unknown }) => React.createElement(React.Fragment, null, children), {
    Screen: () => null,
    Protected: ({ children }: { children?: unknown }) => React.createElement(React.Fragment, null, children),
  });
  return {
    router,
    useRouter: () => router,
    useLocalSearchParams: () => params.current,
    __params: params,
    Stack,
    Redirect: () => null,
    Link: ({ children }: { children: unknown }) => children,
  };
});

require("react-native-gesture-handler/jestSetup");
// Reanimated 4 / Worklets have no native runtime in Jest: their official mocks.
jest.mock("react-native-worklets", () => require("react-native-worklets/lib/module/mock"));
jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"));

jest.mock("expo-keep-awake", () => ({ useKeepAwake: jest.fn(), activateKeepAwakeAsync: jest.fn(), deactivateKeepAwake: jest.fn() }));

// expo-audio: a recorded fake player (no native audio in Jest).
jest.mock("expo-audio", () => {
  const player = { loop: false, play: jest.fn(), pause: jest.fn(), seekTo: jest.fn(() => Promise.resolve()) };
  return { __player: player, createAudioPlayer: jest.fn(() => player), setAudioModeAsync: jest.fn(() => Promise.resolve()) };
});

// expo-notifications: an in-memory schedule; permission is granted unless a test changes `__state`.
jest.mock("expo-notifications", () => {
  const state = { granted: true, canAskAgain: true, scheduled: [] as { identifier: string; content: unknown; trigger: unknown }[], last: null as unknown };
  const perm = () => ({ granted: state.granted, canAskAgain: state.canAskAgain, status: state.granted ? "granted" : "denied" });
  return {
    __state: state,
    AndroidImportance: { HIGH: 4, MAX: 5 },
    AndroidNotificationVisibility: { PUBLIC: 1 },
    AndroidAudioUsage: { ALARM: 4 },
    AndroidAudioContentType: { SONIFICATION: 4 },
    AndroidNotificationPriority: { MAX: "max" },
    SchedulableTriggerInputTypes: { DATE: "date" },
    getPermissionsAsync: jest.fn(async () => perm()),
    requestPermissionsAsync: jest.fn(async () => perm()),
    setNotificationChannelAsync: jest.fn(async () => null),
    setNotificationHandler: jest.fn(),
    getAllScheduledNotificationsAsync: jest.fn(async () => state.scheduled.map((s) => ({ ...s }))),
    scheduleNotificationAsync: jest.fn(async (req: { identifier: string; content: unknown; trigger: unknown }) => {
      state.scheduled.push(req);
      return req.identifier;
    }),
    cancelScheduledNotificationAsync: jest.fn(async (id: string) => {
      state.scheduled = state.scheduled.filter((s) => s.identifier !== id);
    }),
    getPresentedNotificationsAsync: jest.fn(async () => []),
    dismissNotificationAsync: jest.fn(async () => {}),
    getLastNotificationResponseAsync: jest.fn(async () => state.last),
    clearLastNotificationResponseAsync: jest.fn(async () => {}),
    addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  };
});
