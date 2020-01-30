package nodejt400;

import java.sql.Connection;
import com.ibm.as400.access.AS400;
import com.ibm.as400.access.AS400JDBCConnectionHandle;
import com.ibm.as400.access.DataQueue;

public class DataQ {

    private static final String EMPTY_STRING = "";
    private final ConnectionProvider connectionProvider;
    private final String path;

    public DataQ(ConnectionProvider connectionProvider, String path) {
        this.connectionProvider = connectionProvider;
        this.path = path;
    }

    private DataQueue getDataQueue(Connection c) {
        AS400JDBCConnectionHandle handle = (AS400JDBCConnectionHandle) c;
        AS400 as400 = handle.getSystem();
        DataQueue dq = new DataQueue(as400, path);

        return dq;
    }

    public String peek() throws Exception {
        String response = EMPTY_STRING;
        Connection c = connectionProvider.getConnection();

        try {
            DataQueue dq = getDataQueue(c);
            response = dq.peek().getString();
        } catch (Exception ex) {
            throw ex;
        } finally {
            connectionProvider.returnConnection(c);
        }

        return response;
    }

    public String peek(int wait) throws Exception {
        String response = EMPTY_STRING;
        Connection c = connectionProvider.getConnection();

        try {
            DataQueue dq = getDataQueue(c);
            response = dq.peek(wait).getString();
        } catch (Exception ex) {
            throw ex;
        } finally {
            connectionProvider.returnConnection(c);
        }

        return response;
    }

    public String read() throws Exception {
        String response = EMPTY_STRING;
        Connection c = connectionProvider.getConnection();

        try {
            DataQueue dq = getDataQueue(c);
            response = dq.read().getString();
        } catch (Exception ex) {
            throw ex;
        } finally {
            connectionProvider.returnConnection(c);
        }

        return response;
    }

    public String read(int wait) throws Exception {
        String response = EMPTY_STRING;
        Connection c = connectionProvider.getConnection();

        try {
            DataQueue dq = getDataQueue(c);
            response = dq.read(wait).getString();
        } catch (Exception ex) {
            throw ex;
        } finally {
            connectionProvider.returnConnection(c);
        }

        return response;
    }

    public DataQResponse readResponse(int wait) throws Exception {
        String data = read(wait);
        return new DataQResponse(data, this);
    }

    public void write(String data) throws Exception {
        Connection c = connectionProvider.getConnection();

        try {
            DataQueue dq = getDataQueue(c);
            dq.write(data);
        } catch (Exception ex) {
            throw ex;
        } finally {
            connectionProvider.returnConnection(c);
        }
    }
}