import { ChatShell } from "@/components/chat/chat-shell";
import { getAuthSession } from "@fambrain/auth";
import { listSidebarConversations } from "@/server/conversations";
export const dynamic = "force-dynamic";
const Home = async () => {
    const session = await getAuthSession();
    if (!session) {
        return null;
    }
    const initialConversations = await listSidebarConversations(session.userId);
    return (<ChatShell initialConversations={initialConversations} viewer={{
            displayName: session.displayName,
            username: session.username,
            isAdmin: session.role === "ADMIN",
            canManageMembers: session.canManageMembers,
        }}/>);
};
export default Home;
