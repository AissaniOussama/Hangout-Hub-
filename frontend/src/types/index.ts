export interface User {
  id: number
  username: string
  email: string
}

// Feature 1: Group types
export type GroupRole = 'OWNER' | 'ADMIN' | 'MEMBER'

export interface GroupMemberInfo {
  userId: number
  username: string
  role: GroupRole
}

export interface Group {
  id: number
  name: string
  myRole: GroupRole
  inviteToken?: string   // only returned for OWNER / ADMIN
  members: GroupMemberInfo[]
}

// Event role types
export type EventRole = 'OWNER' | 'EDITOR' | 'VIEWER'
export type RsvpStatus = 'ATTENDING' | 'MAYBE' | 'NOT_ATTENDING'

export interface EventParticipantInfo {
  userId: number
  username: string
  rsvpStatus: RsvpStatus | null
  eventRole: EventRole | null
}

export interface ParticipantsResponse {
  myEventRole: EventRole | null
  attending: number
  maybe: number
  participants: EventParticipantInfo[]
}

export interface UserSearchResult {
  id: number
  username: string
}

/** Minimal group shape embedded inside Event responses. */
export interface GroupSummary {
  id: number
  name: string
}

export interface Event {
  id: number
  title: string
  description?: string
  startTime: string
  endTime?: string
  location?: string
  admissionFee?: number
  organizer: User

  // Feature 1: optional group association
  group?: GroupSummary

  // Feature 3: participant limits
  minParticipants?: number
  maxParticipants?: number

  // Feature 7 optional: visibility & series
  isPublic: boolean
  seriesParent?: Pick<Event, 'id' | 'title'>

  // Bring list ("Mitbringliste") toggle
  hasBringList: boolean
}

export interface Rsvp {
  id: number
  event: Event
  user: User
  status: 'ATTENDING' | 'NOT_ATTENDING' | 'MAYBE'
  updatedAt: string
}

export interface Invitation {
  id: number
  event: Event
  invitedUser?: User
  inviteCode: string
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED'
  createdAt: string
}

export interface Message {
  id: number
  event: Event
  sender: User
  content: string
  sentAt: string
}

export type VoteMode = 'SINGLE_CHANGEABLE' | 'SINGLE_LOCKED' | 'MULTIPLE'
export type PollOptionType = 'TEXT' | 'DATE'

export interface PollVoter {
  userId: number
  username: string
}

export interface PollOption {
  id: number
  optionType: PollOptionType
  text?: string
  dateValue?: string
  voteCount: number
  votedByMe: boolean
  voters: PollVoter[]
}

export interface Poll {
  id: number
  question: string
  voteMode: VoteMode
  createdAt: string
  closesAt?: string
  closed: boolean
  options: PollOption[]
}

export interface CreatePollOptionRequest {
  optionType: PollOptionType
  text?: string
  dateValue?: string
}

export interface CreatePollRequest {
  question: string
  voteMode: VoteMode
  closesAt?: string
  options: CreatePollOptionRequest[]
}

export interface BringItem {
  id: number
  event: Event
  description: string
  claimedBy?: User
  reminderSent: boolean
}

export interface Notification {
  id: number
  message: string
  type:
    | 'RSVP_CHANGED'
    | 'NEW_MESSAGE'
    | 'INVITATION_RECEIVED'
    | 'EVENT_UPDATED'
    | 'POLL_CREATED'
    | 'POLL_VOTE'
    | 'BRING_ITEM_REMINDER'
  isRead: boolean
  createdAt: string
  eventId?: number
  link?: string
}

export interface AuthResponse {
  token: string
  userId: number
  username: string
  email: string
}
