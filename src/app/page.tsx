import { CityClient } from "@/components/city/CityClient";
import { getContent } from "@/server/content";

export default async function Home() {
  const content = await getContent();
  return <CityClient content={content} />;
}
