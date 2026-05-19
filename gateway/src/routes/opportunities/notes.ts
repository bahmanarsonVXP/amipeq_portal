import { Hono } from 'hono';
import { queryTwenty } from '../../lib/twenty';
import { createOpportunityNote } from '../../lib/opportunities/notes';
import type { Env } from '../../index';

const app = new Hono<{ Bindings: Env }>();

app.get('/:id/notes', async (c) => {
  const opportunityId = c.req.param('id');
  if (!opportunityId) return c.json({ message: 'ID requis' }, 400);

  const query = `
    query OpportunityNotes($filter: NoteTargetFilterInput!) {
      noteTargets(filter: $filter, first: 100) {
        edges {
          node {
            id
            note {
              id
              title
              createdAt
              bodyV2 { markdown }
            }
          }
        }
      }
    }
  `;

  const data = await queryTwenty<{
    noteTargets: {
      edges: {
        node: {
          id: string;
          note: {
            id: string;
            title: string | null;
            createdAt: string | null;
            bodyV2: { markdown?: string | null } | null;
          } | null;
        };
      }[];
    };
  }>(c.env, query, {
    filter: { targetOpportunityId: { eq: opportunityId } },
  });

  const notes = data.noteTargets.edges
    .map(({ node }) => node.note)
    .filter((note): note is NonNullable<typeof note> => note !== null)
    .map((note) => ({
      id: note.id,
      title: note.title ?? null,
      body: note.bodyV2?.markdown ?? null,
      createdAt: note.createdAt ?? null,
    }))
    .sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });

  return c.json({ notes });
});

app.post('/:id/note', async (c) => {
  const opportunityId = c.req.param('id');
  if (!opportunityId) return c.json({ message: 'ID requis' }, 400);

  const body = await c.req.json<{ body?: string; title?: string }>();
  const noteBody = body.body?.trim();
  if (!noteBody) {
    return c.json({ message: 'Le contenu de la note est requis' }, 400);
  }

  const title = body.title?.trim() || `Note opportunité ${new Date().toLocaleString('fr-FR')}`;
  try {
    const noteId = await createOpportunityNote(c.env, opportunityId, title, noteBody);
    return c.json({ success: true, id: noteId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Création de note impossible';
    return c.json({ message }, 500);
  }
});

export { app as opportunitiesNotesRoutes };
