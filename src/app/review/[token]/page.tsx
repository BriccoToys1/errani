import ReviewForm from './review-form';

interface Props {
  params: Promise<{ token: string }>;
}

export default async function ReviewTokenPage({ params }: Props) {
  const { token } = await params;
  return <ReviewForm token={token} />;
}
