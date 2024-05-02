package nodejt400;

import java.sql.Connection;

import com.ibm.as400.access.AS400;
import com.ibm.as400.access.AS400JDBCConnectionHandle;
import com.ibm.as400.access.MessageFile;
import com.ibm.as400.access.AS400Message;

public class MessageFileHandler {
    private final ConnectionProvider connectionProvider;
    private String path;

    public MessageFileHandler(ConnectionProvider connectionProvider, String path) throws Exception {
        this.connectionProvider = connectionProvider;
        this.path = path;
    }

    private MessageFile openMessageFile(Connection c) throws Exception {
        AS400JDBCConnectionHandle handle = (AS400JDBCConnectionHandle) c;
        AS400 as400 = handle.getSystem();
        MessageFile f = new MessageFile(as400, this.path);
        return f;
    }

    public AS400Message read(final String messageId) throws Exception {
        Connection c = connectionProvider.getConnection();
        try {
            MessageFile f = openMessageFile(c);
            AS400Message entry = f.getMessage(messageId);

            return entry;
        } catch (Exception ex) {
            throw ex;
        }
    }
}