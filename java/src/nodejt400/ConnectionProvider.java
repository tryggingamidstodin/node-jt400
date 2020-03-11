package nodejt400;

import com.ibm.as400.access.AS400;

import java.sql.Connection;

public interface ConnectionProvider
{
	Connection getConnection() throws Exception;

	AS400 getAS400Connection() throws Exception;

	void returnConnection(Connection c) throws Exception;

  	void close();
}