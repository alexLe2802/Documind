/**
 * ChatMode
 *
 * Determines the scope of the AI chatbot conversation.
 *
 * ASK_THIS_DOCUMENT - The user is asking questions about a specific document.
 * ASK_MY_LIBRARY - The user is querying across their entire document library.
 * COMMUNITY_SEARCH - Reserved for community-wide search flows.
 */
export enum ChatMode {
  ASK_THIS_DOCUMENT = 'ASK_THIS_DOCUMENT',
  ASK_MY_LIBRARY = 'ASK_MY_LIBRARY',
  COMMUNITY_SEARCH = 'COMMUNITY_SEARCH',
}
