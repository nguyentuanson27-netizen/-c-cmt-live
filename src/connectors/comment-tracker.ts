export type TrackedComment = {
  username: string;
  text: string;
};

function commentKey(comment: TrackedComment): string {
  return `${comment.username}:${comment.text}`;
}

export function createCommentTracker<ElementLike, CommentLike extends TrackedComment>(
  extract: (element: ElementLike) => CommentLike | null,
  existingElements: Iterable<ElementLike>,
): (element: ElementLike) => CommentLike | null {
  const seenComments = new Set<string>();

  for (const element of existingElements) {
    const comment = extract(element);
    if (comment) {
      seenComments.add(commentKey(comment));
    }
  }

  return (element: ElementLike) => {
    const comment = extract(element);
    if (!comment) {
      return null;
    }

    const key = commentKey(comment);
    if (seenComments.has(key)) {
      return null;
    }

    seenComments.add(key);
    return comment;
  };
}
