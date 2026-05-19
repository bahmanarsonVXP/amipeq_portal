import { queryTwenty } from '../twenty';
import type { Env } from '../../index';

function textToBlocknote(text: string): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks = lines.map((line) => ({
    id: crypto.randomUUID(),
    type: 'paragraph',
    props: {
      textColor: 'default',
      backgroundColor: 'default',
      textAlignment: 'left',
    },
    content: line ? [{ type: 'text', text: line, styles: {} }] : [],
    children: [],
  }));

  return JSON.stringify(blocks);
}

export async function createOpportunityNote(
  env: Env,
  opportunityId: string,
  title: string,
  body: string,
) {
  const createNoteMutation = `
    mutation CreateNote($title: String!, $markdown: String!, $blocknote: String!) {
      createNote(
        data: {
          title: $title
          bodyV2: { markdown: $markdown, blocknote: $blocknote }
        }
      ) {
        id
      }
    }
  `;
  const linkNoteMutation = `
    mutation LinkNote($noteId: ID!, $opportunityId: ID!) {
      createNoteTarget(data: { noteId: $noteId, targetOpportunityId: $opportunityId }) {
        id
      }
    }
  `;

  const noteData = await queryTwenty<{ createNote?: { id?: string | null } | null }>(
    env,
    createNoteMutation,
    {
      title,
      markdown: body,
      blocknote: textToBlocknote(body),
    },
  );
  const noteId = noteData.createNote?.id ?? null;
  if (!noteId) throw new Error("La note a été créée sans identifiant.");

  await queryTwenty(env, linkNoteMutation, {
    noteId,
    opportunityId,
  });

  return noteId;
}
