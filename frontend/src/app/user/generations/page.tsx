import { Container } from "@/shared/ui/Container";
import { AllArtWorks } from "@/widgets/user-dashboard/ui/AllArtWorks";

export const metadata = {
  title: "My Artworks — ClawPuzzle",
};

export default function UserGenerationsPage() {
  return (
    <Container className="pb-10">
      <AllArtWorks />
    </Container>
  );
}
