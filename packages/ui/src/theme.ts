/**
 * React Native / mobile theme — same semantics as `tokens.ts` + `tailwindThemeExtend`.
 */
import { tokens, tailwindThemeExtend } from "./tokens"

export const theme = {
  colors: {
    feed: tokens.feed,
    map: tokens.map,
    post: tokens.post,
    shared: {
      black: tokens.feed.black,
      white: tokens.feed.white,
    },
  },
  typography: {
    fontFamily: tokens.type.fontSans.join(", "),
    titleLg: tokens.type.titleLg,
    titleMd: tokens.type.titleMd,
    button: tokens.type.button,
    label: tokens.type.label,
    meta: tokens.type.meta,
    employerSub: tokens.type.employerSub,
    navLabel: tokens.type.navLabel,
    priceLg: tokens.type.priceLg,
    mapTitle: tokens.type.mapTitle,
    postInput: tokens.type.postInput,
    wageValue: tokens.type.wageValue,
  },
  spacing: tokens.space,
  radius: {
    feedChip: tokens.feed.chipRadiusPx,
    feedCard: tokens.feed.cardRadiusPx,
    map: tokens.map.radiusPx,
    post: tokens.post.radiusPx,
  },
  shadows: {
    mapHard: tailwindThemeExtend.boxShadow["ocap-map-hard"],
    search: tailwindThemeExtend.boxShadow["ocap-search"],
    postButton: tailwindThemeExtend.boxShadow["ocap-post-btn"],
  },
} as const

export type OcapTheme = typeof theme
